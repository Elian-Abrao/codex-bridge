from __future__ import annotations

from dataclasses import dataclass

from .auth import AuthService
from .codex import CodexService
from .config import BrokerConfig, load_config
from .session_store import AuthSessionStore


@dataclass
class BrokerRuntime:
    config: BrokerConfig
    auth_service: AuthService
    codex_service: CodexService


def create_runtime(config: BrokerConfig | None = None) -> BrokerRuntime:
    resolved = config or load_config()
    auth_store = AuthSessionStore(resolved.auth_store_path)
    auth_service = AuthService(session_store=auth_store)
    auth_service.initialize()

    codex_service = CodexService(
        auth_service=auth_service,
        base_url=resolved.codex_base_url,
        user_agent=resolved.user_agent,
    )

    return BrokerRuntime(
        config=resolved,
        auth_service=auth_service,
        codex_service=codex_service,
    )
