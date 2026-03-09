from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


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
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path

    def load(self) -> StoredAuthSession | None:
        try:
            raw = self._file_path.read_text(encoding="utf-8")
            parsed = json.loads(raw)
        except FileNotFoundError:
            return None

        if not isinstance(parsed, dict):
            return None

        session = parsed.get("session")
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

    def save(self, session: StoredAuthSession) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "session": asdict(session),
        }
        temp_path = self._file_path.with_suffix(f"{self._file_path.suffix}.tmp")
        temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        temp_path.replace(self._file_path)

    def clear(self) -> None:
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"version": 1}
        temp_path = self._file_path.with_suffix(f"{self._file_path.suffix}.tmp")
        temp_path.write_text(f"{json.dumps(payload, indent=2)}\n", encoding="utf-8")
        temp_path.replace(self._file_path)
