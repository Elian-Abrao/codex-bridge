from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from codex_bridge.session_store import AuthSessionStore, StoredAuthSession


class FakeKeyring:
    def __init__(self) -> None:
        self.storage: dict[tuple[str, str], str] = {}

    def get_password(self, service: str, username: str) -> str | None:
        return self.storage.get((service, username))

    def set_password(self, service: str, username: str, value: str) -> None:
        self.storage[(service, username)] = value

    def delete_password(self, service: str, username: str) -> None:
        self.storage.pop((service, username), None)


class SessionStoreTests(unittest.TestCase):
    def test_save_uses_keyring_and_writes_metadata_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "auth" / "session.json"
            keyring = FakeKeyring()
            store = AuthSessionStore(file_path, keyring_backend=keyring)
            session = StoredAuthSession(
                provider="codex",
                accessToken="access",
                refreshToken="refresh",
                expiresAt=123,
                updatedAt=456,
                email="user@example.com",
            )

            store.save(session)

            self.assertIn(("codex-bridge", "default"), keyring.storage)
            metadata = json.loads(file_path.read_text(encoding="utf-8"))
            self.assertEqual(metadata["storage"], "keyring")
            self.assertEqual(metadata["session"]["email"], "user@example.com")
            self.assertNotIn("accessToken", metadata["session"])

    def test_load_migrates_legacy_file_to_keyring(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            file_path = Path(temp_dir) / "auth" / "session.json"
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(
                json.dumps(
                    {
                        "version": 1,
                        "session": {
                            "provider": "codex",
                            "accessToken": "legacy-access",
                            "refreshToken": "legacy-refresh",
                            "expiresAt": 123,
                            "updatedAt": 456,
                        },
                    }
                ),
                encoding="utf-8",
            )
            keyring = FakeKeyring()
            store = AuthSessionStore(file_path, keyring_backend=keyring)

            session = store.load()

            self.assertIsNotNone(session)
            assert session is not None
            self.assertEqual(session.accessToken, "legacy-access")
            self.assertIn(("codex-bridge", "default"), keyring.storage)


if __name__ == "__main__":
    unittest.main()
