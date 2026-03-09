from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .api import handle_request
from .config import DEFAULT_BIND_HOST, DEFAULT_BIND_PORT


def create_handler() -> type[BaseHTTPRequestHandler]:
    class BrokerHandler(BaseHTTPRequestHandler):
        server_version = "codex-bridge-broker/0.1.0"

        def do_GET(self) -> None:  # noqa: N802
            self._handle()

        def do_POST(self) -> None:  # noqa: N802
            self._handle()

        def log_message(self, format: str, *args: object) -> None:
            return

        def _handle(self) -> None:
            content_length = int(self.headers.get("Content-Length", "0") or "0")
            body = self.rfile.read(content_length) if content_length > 0 else None
            status, payload = handle_request(self.command, self.path, body)
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    return BrokerHandler


def run_server(host: str = DEFAULT_BIND_HOST, port: int = DEFAULT_BIND_PORT) -> None:
    server = ThreadingHTTPServer((host, port), create_handler())
    print(f"codex-bridge python broker listening on http://{host}:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
