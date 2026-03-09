from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from .config import KEYRING_SERVICE_NAME, KEYRING_USERNAME


def _load_optional_keyring() -> Any | None:
    try:
        import keyring  # type: ignore
    except Exception:
        return None
    return keyring


@dataclass
class StoredAuthSession:
    provider: str
    accessToken: str
    refreshToken: str
    expiresAt: int
    updatedAt: int
    idToken: str | None = None
    accountId: str | None = None
    email: str | None = None
    planType: str | None = None

    def to_public(self) -> dict[str, object]:
        return {
            "provider": self.provider,
            "accountId": self.accountId,
            "email": self.email,
            "planType": self.planType,
            "expiresAt": self.expiresAt,
            "updatedAt": self.updatedAt,
        }


class AuthSessionStore:
    def __init__(
        self,
        file_path: Path,
        *,
        keyring_backend: Any | None = None,
        keyring_service: str = KEYRING_SERVICE_NAME,
        keyring_username: str = KEYRING_USERNAME,
        prefer_keyring: bool = True,
    ) -> None:
        self._file_path = file_path
        self._keyring_backend = keyring_backend if keyring_backend is not None else (_load_optional_keyring() if prefer_keyring else None)
        self._keyring_service = keyring_service
        self._keyring_username = keyring_username

    def load(self) -> StoredAuthSession | None:
        session = self._load_from_keyring()
        if session:
            return session

        try:
            raw = self._file_path.read_text(encoding="utf-8")
            parsed = json.loads(raw)
        except FileNotFoundError:
            return None

        if not isinstance(parsed, dict):
            return None

        if parsed.get("storage") == "keyring":
            return None

        session = parsed.get("session")
        loaded = self._parse_session(session)
        if loaded and self._keyring_backend:
            self.save(loaded)
        return loaded

    def save(self, session: StoredAuthSession) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        if self._keyring_backend:
            self._keyring_backend.set_password(
                self._keyring_service,
                self._keyring_username,
                json.dumps(asdict(session)),
            )
            payload = {
                "version": 2,
                "storage": "keyring",
                "session": session.to_public(),
            }
        else:
            payload = {
                "version": 1,
                "session": asdict(session),
            }
        temp_path = self._file_path.with_suffix(f"{self._file_path.suffix}.tmp")
        temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        temp_path.replace(self._file_path)

    def clear(self) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        if self._keyring_backend:
            try:
                self._keyring_backend.delete_password(self._keyring_service, self._keyring_username)
            except Exception:
                pass
            payload = {"version": 2, "storage": "keyring"}
        else:
            payload = {"version": 1}
        temp_path = self._file_path.with_suffix(f"{self._file_path.suffix}.tmp")
        temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        temp_path.replace(self._file_path)

    def _load_from_keyring(self) -> StoredAuthSession | None:
        if not self._keyring_backend:
            return None
        try:
            raw = self._keyring_backend.get_password(self._keyring_service, self._keyring_username)
        except Exception:
            return None
        if not isinstance(raw, str) or not raw.strip():
            return None
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return self._parse_session(parsed)

    def _parse_session(self, session: object) -> StoredAuthSession | None:
        if not isinstance(session, dict):
            return None

        required = {
            "provider": str,
            "accessToken": str,
            "refreshToken": str,
            "expiresAt": int,
            "updatedAt": int,
        }
        for key, expected_type in required.items():
            if not isinstance(session.get(key), expected_type):
                return None

        return StoredAuthSession(
            provider=session["provider"],
            accessToken=session["accessToken"],
            refreshToken=session["refreshToken"],
            expiresAt=session["expiresAt"],
            updatedAt=session["updatedAt"],
            idToken=session.get("idToken"),
            accountId=session.get("accountId"),
            email=session.get("email"),
            planType=session.get("planType"),
        )
