from __future__ import annotations

import argparse
import json
import platform
import queue
import sys
import threading
import time
import webbrowser
from importlib import metadata
from pathlib import Path

from ..bootstrap.config import DEFAULT_BIND_HOST, DEFAULT_BIND_PORT, load_config
from ..bootstrap.runtime import create_runtime
from ..domain.codex import DEFAULT_CODEX_MODEL, normalize_reasoning_effort
from ..domain.errors import BrokerError
from .http.server import run_server
from ..version import PACKAGE_VERSION


def _installed_version() -> str:
    try:
        return metadata.version("codex-bridge")
    except metadata.PackageNotFoundError:
        return PACKAGE_VERSION


def _print_json(payload: dict[str, object]) -> None:
    print(json.dumps(payload, indent=2))


def _print_auth_summary(state: dict[str, object]) -> None:
    session = state.get("session")
    if not isinstance(session, dict):
        print("Authentication: not logged in")
        active_login = state.get("activeLogin")
        if isinstance(active_login, dict):
            print("Login flow: in progress")
            print(f"Auth URL: {active_login.get('authUrl', '')}")
        return

    print("Authentication: active")
    print(f"Email: {session.get('email') or 'unknown'}")
    print(f"Plan: {session.get('planType') or 'unknown'}")
    print(f"Account ID: {session.get('accountId') or 'unknown'}")
    print(f"Expires At: {session.get('expiresAt')}")
    print(f"Updated At: {session.get('updatedAt')}")
    if state.get("isRefreshing"):
        print("Refresh: in progress")


def _print_capabilities(capabilities: dict[str, object]) -> None:
    print(f"Provider: {capabilities.get('provider', 'codex')}")
    print(f"Billing: {capabilities.get('billingMode', 'monthly')}")
    print(f"Authenticated: {'yes' if capabilities.get('authenticated') else 'no'}")
    if capabilities.get("accountEmail"):
        print(f"Account: {capabilities.get('accountEmail')}")
    print(f"Default model: {capabilities.get('defaultModel')}")
    print(f"Default reasoning: {capabilities.get('defaultReasoningEffort')}")
    models = capabilities.get("models")
    if isinstance(models, list):
        print("Models:")
        for item in models:
            if isinstance(item, dict):
                marker = " (recommended)" if item.get("recommended") else ""
                print(f"  - {item.get('id')}{marker}")
    efforts = capabilities.get("reasoningEfforts")
    if isinstance(efforts, list):
        print("Reasoning:")
        for item in efforts:
            if isinstance(item, dict):
                marker = " (recommended)" if item.get("recommended") else ""
                print(f"  - {item.get('id')}{marker}")


def _build_doctor_report(config, state: dict[str, object], capabilities: dict[str, object]) -> dict[str, object]:
    auth_store = Path(config.auth_store_path).expanduser()
    session = state.get("session") if isinstance(state, dict) else None
    return {
        "service": "codex-bridge",
        "version": _installed_version(),
        "python": {
            "version": platform.python_version(),
            "implementation": platform.python_implementation(),
            "executable": sys.executable,
        },
        "config": {
            "bindHost": config.bind_host,
            "bindPort": config.bind_port,
            "authStorePath": str(auth_store),
            "authStoreExists": auth_store.exists(),
            "keyringEnabled": config.prefer_keyring,
            "codexBaseUrl": config.codex_base_url,
            "userAgent": config.user_agent,
        },
        "auth": {
            "authenticated": isinstance(session, dict),
            "email": session.get("email") if isinstance(session, dict) else None,
            "planType": session.get("planType") if isinstance(session, dict) else None,
            "hasActiveLogin": isinstance(state.get("activeLogin"), dict),
            "isRefreshing": bool(state.get("isRefreshing")),
        },
        "capabilities": {
            "defaultModel": capabilities.get("defaultModel"),
            "defaultReasoningEffort": capabilities.get("defaultReasoningEffort"),
            "modelCount": len(capabilities.get("models", [])) if isinstance(capabilities.get("models"), list) else 0,
            "reasoningCount": len(capabilities.get("reasoningEfforts", []))
            if isinstance(capabilities.get("reasoningEfforts"), list)
            else 0,
        },
    }


def _print_doctor_report(report: dict[str, object]) -> None:
    print(f"codex-bridge {report.get('version')}")
    python_info = report.get("python")
    if isinstance(python_info, dict):
        print(f"Python: {python_info.get('version')} ({python_info.get('executable')})")
    config = report.get("config")
    if isinstance(config, dict):
        print(f"Bind: http://{config.get('bindHost')}:{config.get('bindPort')}")
        print(f"Auth store: {config.get('authStorePath')}")
        print(f"Auth store exists: {'yes' if config.get('authStoreExists') else 'no'}")
        print(f"Keyring enabled: {'yes' if config.get('keyringEnabled') else 'no'}")
        print(f"Codex base URL: {config.get('codexBaseUrl')}")
    auth = report.get("auth")
    if isinstance(auth, dict):
        print(f"Authenticated: {'yes' if auth.get('authenticated') else 'no'}")
        if auth.get("email"):
            print(f"Account: {auth.get('email')}")
        if auth.get("planType"):
            print(f"Plan: {auth.get('planType')}")
        print(f"Active login flow: {'yes' if auth.get('hasActiveLogin') else 'no'}")
    caps = report.get("capabilities")
    if isinstance(caps, dict):
        print(f"Default model: {caps.get('defaultModel')}")
        print(f"Default reasoning: {caps.get('defaultReasoningEffort')}")
        print(f"Advertised models: {caps.get('modelCount')}")
        print(f"Advertised reasoning levels: {caps.get('reasoningCount')}")


def _stream_chat_to_stdout(runtime, payload: dict[str, object]) -> dict[str, object]:
    request_id: str | None = None
    output_parts: list[str] = []
    for event in runtime.chat_service.stream_chat(payload):
        request_id = request_id or str(event.get("requestId"))
        kind = event.get("kind")
        if kind == "status":
            continue
        if kind == "delta" and isinstance(event.get("delta"), str):
            chunk = event["delta"]
            output_parts.append(chunk)
            print(chunk, end="", flush=True)
            continue
        if kind == "error":
            print()
            raise BrokerError(502, str(event.get("message") or "Codex returned an error."))
    if output_parts:
        print()
    return {
        "requestId": request_id or "",
        "provider": "codex",
        "model": str(payload.get("model") or DEFAULT_CODEX_MODEL),
        "outputText": "".join(output_parts),
    }


def _run_interactive_chat(runtime, *, model: str, reasoning: str) -> None:
    active_model = model
    active_reasoning = normalize_reasoning_effort(reasoning)
    messages: list[dict[str, str]] = []

    print("Interactive chat")
    print("Commands: /help /reset /model <name> /reasoning <level> /status /logout /exit")

    while True:
        try:
            prompt = input("codex> ").strip()
        except EOFError:
            print()
            return
        except KeyboardInterrupt:
            print()
            return

        if not prompt:
            continue
        if prompt in {"/exit", "/quit"}:
            return
        if prompt == "/help":
            print("Commands: /help /reset /model <name> /reasoning <level> /status /logout /exit")
            continue
        if prompt == "/reset":
            messages.clear()
            print("Conversation reset.")
            continue
        if prompt.startswith("/model "):
            active_model = prompt.split(" ", 1)[1].strip() or active_model
            print(f"Model set to {active_model}")
            continue
        if prompt.startswith("/reasoning "):
            active_reasoning = normalize_reasoning_effort(prompt.split(" ", 1)[1].strip())
            print(f"Reasoning set to {active_reasoning}")
            continue
        if prompt == "/status":
            print(f"Model: {active_model}")
            print(f"Reasoning: {active_reasoning}")
            print(f"Messages in context: {len(messages)}")
            continue
        if prompt == "/logout":
            runtime.auth_service.logout()
            messages.clear()
            print("Session cleared. Exiting interactive chat.")
            return

        messages.append({"role": "user", "content": prompt})
        response = _stream_chat_to_stdout(
            runtime,
            {
                "model": active_model,
                "reasoningEffort": active_reasoning,
                "messages": messages,
            },
        )
        messages.append({"role": "assistant", "content": str(response["outputText"])})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="codex-bridge")
    parser.add_argument("--json", action="store_true", help="Emit structured JSON output when supported.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve", help="Start the broker.")
    serve_parser.add_argument("--host", default=DEFAULT_BIND_HOST)
    serve_parser.add_argument("--port", type=int, default=DEFAULT_BIND_PORT)

    login_parser = subparsers.add_parser("login", help="Start the OAuth login flow.")
    login_parser.add_argument("--no-browser", action="store_true", help="Do not try to open the browser automatically.")
    subparsers.add_parser("logout", help="Clear the local Codex session.")
    subparsers.add_parser("status", help="Print broker auth state.")
    subparsers.add_parser("whoami", help="Print the currently authenticated account, if any.")
    subparsers.add_parser("doctor", help="Print a local diagnostics report.")
    subparsers.add_parser("version", help="Print the installed broker version.")
    subparsers.add_parser("models", help="List advertised models and reasoning levels.")

    chat_parser = subparsers.add_parser("chat", help="Send a one-shot chat request through the broker runtime.")
    chat_parser.add_argument("prompt", nargs="*")
    chat_parser.add_argument("--model", default=DEFAULT_CODEX_MODEL)
    chat_parser.add_argument("--reasoning", default="medium")
    chat_parser.add_argument("--interactive", action="store_true", help="Start a persistent terminal chat session.")
    chat_parser.add_argument("--stream", action="store_true", help="Stream the response directly to stdout.")

    return parser


def _collect_manual_callback_input(result_queue: "queue.SimpleQueue[str]", stop_event: threading.Event) -> None:
    if stop_event.wait(5):
        return
    try:
        value = input(
            "Automatic callback not detected yet. Paste the final redirect URL only if the browser did not return to the broker automatically: "
        ).strip()
    except EOFError:
        value = ""
    if not stop_event.is_set():
        result_queue.put(value)


def _wait_for_login_completion(runtime, *, expires_at: int, allow_manual_prompt: bool) -> dict[str, object]:
    manual_input_queue: "queue.SimpleQueue[str]" = queue.SimpleQueue()
    stop_event = threading.Event()
    manual_input_thread: threading.Thread | None = None

    if allow_manual_prompt and sys.stdin.isatty():
        manual_input_thread = threading.Thread(
            target=_collect_manual_callback_input,
            args=(manual_input_queue, stop_event),
            daemon=True,
        )
        manual_input_thread.start()

    try:
        while int(time.time() * 1000) < expires_at:
            while True:
                try:
                    redirect_url = manual_input_queue.get_nowait()
                except queue.Empty:
                    break
                if redirect_url:
                    runtime.auth_service.complete_manual_login(redirect_url)

            state = runtime.auth_service.get_state().to_dict()
            if state.get("session") or not state.get("activeLogin"):
                return state
            time.sleep(0.25)
    finally:
        stop_event.set()
        if manual_input_thread and manual_input_thread.is_alive():
            manual_input_thread.join(timeout=0.1)

    return runtime.auth_service.get_state().to_dict()


def _run_login(*, as_json: bool, open_browser: bool) -> None:
    runtime = create_runtime()
    current = runtime.auth_service.get_state().to_dict()
    if current.get("session"):
        if as_json:
            _print_json(current)
        else:
            print("A Codex session is already active.")
            _print_auth_summary(current)
        return

    login = runtime.auth_service.start_login()
    auth_url = login.auth_url
    redirect_uri = login.redirect_uri
    expires_at = login.expires_at

    opened = False if not open_browser else webbrowser.open(auth_url)
    print("No active Codex session found.")
    if open_browser:
        print("Browser opened automatically." if opened else "Open this URL in your browser:")
    else:
        print("Open this URL in your browser:")
    print(auth_url)
    print(f"Expected redirect: {redirect_uri}")
    print("Waiting for the browser callback. If the local callback succeeds, the terminal will continue automatically.")

    final_state = _wait_for_login_completion(runtime, expires_at=expires_at, allow_manual_prompt=not as_json)
    if not final_state.get("session"):
        raise BrokerError(408, "Login was not completed within the timeout.")
    if as_json:
        _print_json(final_state)
    else:
        print("Login completed.")
        _print_auth_summary(final_state)


def _run_logout(*, as_json: bool) -> None:
    runtime = create_runtime()
    runtime.auth_service.logout()
    if as_json:
        _print_json({"ok": True, "message": "Session cleared."})
    else:
        print("Session cleared.")


def _run_status(*, as_json: bool) -> None:
    runtime = create_runtime()
    state = runtime.auth_service.get_state().to_dict()
    if as_json:
        _print_json(state)
    else:
        _print_auth_summary(state)


def _run_whoami(*, as_json: bool) -> None:
    runtime = create_runtime()
    state = runtime.auth_service.get_state().to_dict()
    session = state.get("session")
    payload = {
        "authenticated": isinstance(session, dict),
        "provider": "codex",
        "email": session.get("email") if isinstance(session, dict) else None,
        "planType": session.get("planType") if isinstance(session, dict) else None,
        "accountId": session.get("accountId") if isinstance(session, dict) else None,
    }
    if as_json:
        _print_json(payload)
    elif payload["authenticated"]:
        print(f"Logged in as {payload['email'] or 'unknown'}")
        print(f"Plan: {payload['planType'] or 'unknown'}")
        print(f"Account ID: {payload['accountId'] or 'unknown'}")
    else:
        print("Not authenticated.")


def _run_doctor(*, as_json: bool) -> None:
    config = load_config()
    runtime = create_runtime(config)
    state = runtime.auth_service.get_state().to_dict()
    capabilities = runtime.chat_service.get_capabilities()
    report = _build_doctor_report(config, state, capabilities)
    if as_json:
        _print_json(report)
    else:
        _print_doctor_report(report)


def _run_version(*, as_json: bool) -> None:
    payload = {"service": "codex-bridge", "version": _installed_version()}
    if as_json:
        _print_json(payload)
    else:
        print(f"{payload['service']} {payload['version']}")


def _run_models(*, as_json: bool) -> None:
    runtime = create_runtime()
    capabilities = runtime.chat_service.get_capabilities()
    if as_json:
        _print_json(capabilities)
    else:
        _print_capabilities(capabilities)


def _run_chat(
    prompt_parts: list[str],
    model: str,
    reasoning: str,
    *,
    as_json: bool,
    interactive: bool,
    stream: bool,
) -> None:
    runtime = create_runtime()
    if interactive:
        if as_json:
            raise BrokerError(400, "`--json` is not supported with `chat --interactive`.")
        _run_interactive_chat(runtime, model=model, reasoning=reasoning)
        return
    if stream and as_json:
        raise BrokerError(400, "`--json` is not supported with `chat --stream`.")

    prompt = " ".join(prompt_parts).strip()
    if not prompt:
        prompt = input("codex> ").strip()
    if not prompt:
        raise BrokerError(400, "Prompt cannot be empty.")

    payload = {
        "model": model,
        "reasoningEffort": normalize_reasoning_effort(reasoning),
        "messages": [{"role": "user", "content": prompt}],
    }
    response = _stream_chat_to_stdout(runtime, payload) if stream else runtime.chat_service.chat(payload)
    if as_json:
        _print_json(response)
    elif not stream:
        print(response["outputText"])


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command == "serve":
            config = load_config(host=args.host, port=args.port)
            runtime = create_runtime(config)
            run_server(host=config.bind_host, port=config.bind_port, runtime=runtime)
            return

        if args.command == "login":
            _run_login(as_json=args.json, open_browser=not args.no_browser)
            return

        if args.command == "logout":
            _run_logout(as_json=args.json)
            return

        if args.command == "status":
            _run_status(as_json=args.json)
            return

        if args.command == "whoami":
            _run_whoami(as_json=args.json)
            return

        if args.command == "doctor":
            _run_doctor(as_json=args.json)
            return

        if args.command == "version":
            _run_version(as_json=args.json)
            return

        if args.command == "models":
            _run_models(as_json=args.json)
            return

        if args.command == "chat":
            _run_chat(
                args.prompt,
                args.model,
                args.reasoning,
                as_json=args.json,
                interactive=args.interactive,
                stream=args.stream,
            )
            return

        parser.error(f"Unsupported command: {args.command}")
    except BrokerError as exc:
        print(str(exc))
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
