from __future__ import annotations

import html
import threading
import time
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import error, parse, request

from .errors import BrokerError


@dataclass(frozen=True)
class CallbackPayload:
    code: str
    state: str


def _build_html_response(title: str, message: str) -> str:
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{safe_title}</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f4efe4;
      --ink: #14211f;
      --muted: #586461;
      --card: rgba(255, 252, 246, 0.92);
      --accent: #1c8c63;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top left, rgba(28, 140, 99, 0.18), transparent 30%),
        radial-gradient(circle at bottom right, rgba(15, 107, 74, 0.16), transparent 32%),
        linear-gradient(160deg, #f6f1e7 0%, #efe6d5 45%, #e9dfcb 100%);
      color: var(--ink);
      font-family: "Avenir Next", "Segoe UI", sans-serif;
    }}
    .card {{
      width: min(720px, 100%);
      padding: 32px 30px 26px;
      border-radius: 28px;
      border: 1px solid rgba(20, 33, 31, 0.08);
      background: var(--card);
      box-shadow: 0 28px 80px rgba(20, 33, 31, 0.14);
    }}
    .eyebrow {{
      display: inline-block;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(28, 140, 99, 0.16);
      color: #0f6b4a;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }}
    h1 {{
      margin: 22px 0 10px;
      font-size: clamp(32px, 6vw, 56px);
      line-height: 0.96;
      letter-spacing: -0.04em;
    }}
    p {{
      margin: 0;
      font-size: 17px;
      line-height: 1.6;
      color: var(--muted);
    }}
    button {{
      margin-top: 28px;
      border: 0;
      border-radius: 999px;
      padding: 13px 18px;
      background: linear-gradient(180deg, #20996c, #0f6b4a);
      color: #f7fff9;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }}
  </style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">Codex Bridge Authorized</div>
    <h1>{safe_title}</h1>
    <p>{safe_message}</p>
    <button type="button" onclick="window.close()">Close this tab</button>
  </main>
</body>
</html>"""


def _normalize_input(value: str) -> parse.ParseResult:
    trimmed = value.strip()
    if not trimmed:
        raise BrokerError(400, "Paste the full redirect URL containing code and state.")

    parsed = parse.urlparse(trimmed)
    if parsed.scheme and parsed.netloc:
        return parsed

    query_only = trimmed if trimmed.startswith("?") else f"?{trimmed}"
    return parse.urlparse(f"http://localhost{query_only}")


def parse_manual_callback_input(value: str, expected_state: str) -> CallbackPayload:
    parsed = _normalize_input(value)
    params = parse.parse_qs(parsed.query)
    code = (params.get("code", [""])[0] or "").strip()
    state = (params.get("state", [""])[0] or "").strip()

    if not code:
        raise BrokerError(400, "Redirect URL is missing the authorization code.")
    if not state:
        raise BrokerError(400, "Redirect URL is missing the state parameter.")
    if state != expected_state:
        raise BrokerError(400, "OAuth state mismatch. The login flow was rejected to prevent CSRF.")

    return CallbackPayload(code=code, state=state)


def _request_cancellation(host: str, port: int, cancel_path: str) -> None:
    target = f"http://{host}:{port}{cancel_path}"
    try:
        request.urlopen(target, timeout=2).read()
    except Exception:
        return


class LocalCallbackServer:
    def __init__(
        self,
        *,
        host: str,
        port: int,
        callback_path: str,
        cancel_path: str,
        expected_state: str,
        timeout_seconds: float,
        success_title: str,
        success_message: str,
        on_callback,
    ) -> None:
        self._host = host
        self._port = port
        self._callback_path = callback_path
        self._cancel_path = cancel_path
        self._expected_state = expected_state
        self._timeout_seconds = timeout_seconds
        self._success_title = success_title
        self._success_message = success_message
        self._on_callback = on_callback
        self._lock = threading.RLock()
        self._server: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None
        self._timeout: threading.Timer | None = None

    def start(self) -> None:
        attempted_cancellation = False
        while True:
            try:
                self._listen_once()
                break
            except OSError as exc:
                if getattr(exc, "errno", None) == 98 and not attempted_cancellation:
                    attempted_cancellation = True
                    _request_cancellation(self._host, self._port, self._cancel_path)
                    time.sleep(0.2)
                    continue
                raise

        timeout = threading.Timer(self._timeout_seconds, self.close)
        timeout.daemon = True
        timeout.start()
        self._timeout = timeout

    def close(self) -> None:
        with self._lock:
            timeout = self._timeout
            self._timeout = None
            server = self._server
            thread = self._thread
            self._server = None
            self._thread = None

        if timeout:
            timeout.cancel()

        if server:
            server.shutdown()
            server.server_close()

        if thread and thread is not threading.current_thread():
            thread.join(timeout=1)

    def _listen_once(self) -> None:
        server = ThreadingHTTPServer((self._host, self._port), self._create_handler())
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        with self._lock:
            self._server = server
            self._thread = thread

    def _create_handler(self) -> type[BaseHTTPRequestHandler]:
        callback_path = self._callback_path
        cancel_path = self._cancel_path
        expected_state = self._expected_state
        success_title = self._success_title
        success_message = self._success_message
        on_callback = self._on_callback
        owner = self

        class CallbackHandler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: object) -> None:
                return

            def do_GET(self) -> None:  # noqa: N802
                parsed = parse.urlparse(self.path)
                if parsed.path == cancel_path:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"Cancellation requested.")
                    threading.Thread(target=owner.close, daemon=True).start()
                    return

                if parsed.path != callback_path:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"Not found.")
                    return

                query = parse.parse_qs(parsed.query)
                code = (query.get("code", [""])[0] or "").strip()
                state = (query.get("state", [""])[0] or "").strip()

                if not code or not state or state != expected_state:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"Invalid OAuth callback.")
                    return

                payload = CallbackPayload(code=code, state=state)
                body = _build_html_response(success_title, success_message).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

                threading.Thread(target=on_callback, args=(payload,), daemon=True).start()
                threading.Thread(target=owner.close, daemon=True).start()

        return CallbackHandler
