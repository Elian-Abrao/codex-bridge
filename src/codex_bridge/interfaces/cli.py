from __future__ import annotations

import argparse
import json
import time
import webbrowser

from ..bootstrap.config import DEFAULT_BIND_HOST, DEFAULT_BIND_PORT, load_config
from ..bootstrap.runtime import create_runtime
from ..domain.codex import DEFAULT_CODEX_MODEL, normalize_reasoning_effort
from ..domain.errors import BrokerError
from .http.server import run_server


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="codex-bridge")
    subparsers = parser.add_subparsers(dest="command", required=True)

    serve_parser = subparsers.add_parser("serve", help="Start the broker.")
    serve_parser.add_argument("--host", default=DEFAULT_BIND_HOST)
    serve_parser.add_argument("--port", type=int, default=DEFAULT_BIND_PORT)

    subparsers.add_parser("login", help="Start the OAuth login flow.")
    subparsers.add_parser("logout", help="Clear the local Codex session.")
    subparsers.add_parser("status", help="Print broker auth state.")
    subparsers.add_parser("models", help="List advertised models and reasoning levels.")

    chat_parser = subparsers.add_parser("chat", help="Send a one-shot chat request through the broker runtime.")
    chat_parser.add_argument("prompt", nargs="*")
    chat_parser.add_argument("--model", default=DEFAULT_CODEX_MODEL)
    chat_parser.add_argument("--reasoning", default="medium")

    return parser


def _wait_for_session(runtime, expires_at: int) -> dict[str, object]:
    while int(time.time() * 1000) < expires_at:
        state = runtime.auth_service.get_state().to_dict()
        if state.get("session"):
            return state
        if not state.get("activeLogin"):
            return state
        time.sleep(1)
    return runtime.auth_service.get_state().to_dict()


def _run_login() -> None:
    runtime = create_runtime()
    current = runtime.auth_service.get_state().to_dict()
    if current.get("session"):
        print(json.dumps(current, indent=2))
        return

    login = runtime.auth_service.start_login()
    auth_url = login.auth_url
    redirect_uri = login.redirect_uri
    expires_at = login.expires_at

    opened = webbrowser.open(auth_url)
    print("No active Codex session found.")
    print("Browser opened automatically." if opened else "Open this URL in your browser:")
    print(auth_url)
    print(f"Expected redirect: {redirect_uri}")

    callback = input(
        "If the browser shows 'Access granted', just press Enter. Paste the final redirect URL only if automatic callback fails: "
    ).strip()

    if callback:
        runtime.auth_service.complete_manual_login(callback)
        print(json.dumps(runtime.auth_service.get_state().to_dict(), indent=2))
        return

    final_state = _wait_for_session(runtime, expires_at)
    if not final_state.get("session"):
        raise BrokerError(408, "Login was not completed within the timeout.")
    print(json.dumps(final_state, indent=2))


def _run_logout() -> None:
    runtime = create_runtime()
    runtime.auth_service.logout()
    print("Session cleared.")


def _run_status() -> None:
    runtime = create_runtime()
    print(json.dumps(runtime.auth_service.get_state().to_dict(), indent=2))


def _run_models() -> None:
    runtime = create_runtime()
    capabilities = runtime.chat_service.get_capabilities()
    print(json.dumps(capabilities, indent=2))


def _run_chat(prompt_parts: list[str], model: str, reasoning: str) -> None:
    prompt = " ".join(prompt_parts).strip()
    if not prompt:
        prompt = input("codex> ").strip()
    if not prompt:
        raise BrokerError(400, "Prompt cannot be empty.")

    runtime = create_runtime()
    response = runtime.chat_service.chat(
        {
            "model": model,
            "reasoningEffort": normalize_reasoning_effort(reasoning),
            "messages": [{"role": "user", "content": prompt}],
        }
    )
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
            _run_login()
            return

        if args.command == "logout":
            _run_logout()
            return

        if args.command == "status":
            _run_status()
            return

        if args.command == "models":
            _run_models()
            return

        if args.command == "chat":
            _run_chat(args.prompt, args.model, args.reasoning)
            return

        parser.error(f"Unsupported command: {args.command}")
    except BrokerError as exc:
        print(str(exc))
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
