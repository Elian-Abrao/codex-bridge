from __future__ import annotations

import json
import threading
import time
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer

from codex_bridge_broker.config import BRIDGE_API_PREFIX
from codex_bridge_broker.server import create_handler


class BrokerApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), create_handler())
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        time.sleep(0.05)
        self.host, self.port = self.server.server_address

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=1)

    def request(self, method: str, path: str) -> tuple[int, dict[str, object]]:
        connection = HTTPConnection(self.host, self.port, timeout=5)
        try:
            connection.request(method, path)
            response = connection.getresponse()
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
        finally:
            connection.close()

    def test_health_route(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/health")
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"ok": True, "service": "codex-bridge"})

    def test_auth_state_route(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/auth/state")
        self.assertEqual(status, 200)
        self.assertEqual(payload, {"isRefreshing": False})

    def test_capabilities_route(self) -> None:
        status, payload = self.request("GET", f"{BRIDGE_API_PREFIX}/providers/codex/options")
        self.assertEqual(status, 200)
        self.assertEqual(payload["provider"], "codex")
        self.assertEqual(payload["authenticated"], False)
        self.assertGreater(len(payload["models"]), 0)

    def test_unimplemented_login_route(self) -> None:
        status, payload = self.request("POST", f"{BRIDGE_API_PREFIX}/auth/login")
        self.assertEqual(status, 501)
        self.assertIn("Python broker skeleton", payload["error"])


if __name__ == "__main__":
    unittest.main()
