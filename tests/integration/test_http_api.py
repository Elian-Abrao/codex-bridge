from __future__ import annotations

import json
import tempfile
import threading
import time
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

from codex_bridge.bootstrap.config import BRIDGE_API_PREFIX, load_config
from codex_bridge.bootstrap.runtime import create_runtime
from codex_bridge.interfaces.http.server import create_handler


class BrokerApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        auth_store_path = str(Path(self.temp_dir.name) / "auth" / "codex-session.json")
        self.runtime = create_runtime(load_config(auth_store_path=auth_store_path, prefer_keyring=False))
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler(self.runtime))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        time.sleep(0.05)
        self.host, self.port = self.server.server_address

    def tearDown(self) -> None:
        self.runtime.auth_service.logout()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=1)
        self.temp_dir.cleanup()

    def request(
        self,
        method: str,
        path: str,
        body: dict[str, object] | None = None,
    ) -> tuple[int, dict[str, object]]:
        connection = HTTPConnection(self.host, self.port, timeout=5)
        payload = None if body is None else json.dumps(body)
        headers = {} if body is None else {"Content-Type": "application/json"}
        try:
            connection.request(method, path, body=payload, headers=headers)
            response = connection.getresponse()
            response_body = response.read().decode("utf-8")
            return response.status, json.loads(response_body)
        finally:
            connection.close()

    def test_health_route(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"ok": True, "service": "codex-bridge"})

    def test_auth_state_route_without_session(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/auth/state")
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"isRefreshing": False})

    def test_capabilities_route_without_session(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/providers/codex/options")
        self.assertEqual(status, 200)
        self.assertEqual(payload["provider"], "codex")
        self.assertEqual(payload["authenticated"], False)
        self.assertGreater(len(payload["models"]), 0)

    def test_login_route_returns_auth_url(self) -> None:
        status, payload = self.request("POST", f"{BRIDGE_API_PREFIX}/auth/login")
        self.assertEqual(status, 200)
        self.assertEqual(payload["provider"], "codex")
        self.assertIn("/oauth/authorize?", payload["authUrl"])
        self.assertEqual(payload["manualFallback"], True)

    def test_chat_requires_session(self) -> None:
        status, payload = self.request(
            "POST",
            f"{BRIDGE_API_PREFIX}/chat",
            {"messages": [{"role": "user", "content": "Oi"}]},
        )
        self.assertEqual(status, 401)
        self.assertIn("No authenticated Codex session", payload["error"])


if __name__ == "__main__":
    unittest.main()
