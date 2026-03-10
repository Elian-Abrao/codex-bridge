from __future__ import annotations

from types import SimpleNamespace
import unittest

from codex_bridge.app.chat_service import ChatService
from codex_bridge.domain.auth import AuthSession


class FakeAuthService:
    def __init__(self) -> None:
        self.session = AuthSession(
            provider="codex",
            access_token="access",
            refresh_token="refresh",
            expires_at=9_999_999,
            updated_at=1_000,
            email="user@example.com",
        )

    def get_state(self):
        return SimpleNamespace(session=self.session)

    def get_valid_session(self) -> AuthSession:
        return self.session


class FakeCodexGateway:
    def __init__(self) -> None:
        self.last_messages = None

    def stream_chat(self, *, request_id, session, model, reasoning_effort, messages):
        self.last_messages = messages
        yield {"requestId": request_id, "provider": "codex", "kind": "delta", "delta": "OK"}
        yield {"requestId": request_id, "provider": "codex", "kind": "done"}


class ChatServiceTests(unittest.TestCase):
    def test_plain_chat_injects_non_agent_system_message(self) -> None:
        gateway = FakeCodexGateway()
        service = ChatService(auth_service=FakeAuthService(), codex_gateway=gateway)

        response = service.chat(
            {
                "messages": [{"role": "user", "content": "List the files"}],
            }
        )

        self.assertEqual(response["outputText"], "OK")
        assert gateway.last_messages is not None
        self.assertEqual(gateway.last_messages[0]["role"], "system")
        self.assertIn("plain chat mode", gateway.last_messages[0]["content"])

    def test_agent_mode_does_not_inject_plain_chat_guard(self) -> None:
        gateway = FakeCodexGateway()
        service = ChatService(auth_service=FakeAuthService(), codex_gateway=gateway)

        service.chat(
            {
                "executionMode": "agent",
                "messages": [{"role": "user", "content": "Use a tool if needed"}],
            }
        )

        assert gateway.last_messages is not None
        self.assertEqual(len(gateway.last_messages), 1)
        self.assertEqual(gateway.last_messages[0]["role"], "user")


if __name__ == "__main__":
    unittest.main()
