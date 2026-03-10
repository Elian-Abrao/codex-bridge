from __future__ import annotations

from dataclasses import dataclass

from pathlib import Path

from ..app import AgentService, AuthService, ChatService
from ..infra.auth.callback_server import LoopbackCallbackServerFactory
from ..infra.auth.oauth_gateway import CODEX_OAUTH_PROVIDER, OpenAIOAuthGateway
from ..infra.codex.http_gateway import CodexHttpGateway
from ..infra.storage.session_store import FileSystemSessionStore
from ..infra.tools import ReadFileTool, ShellTool, WriteFileTool
from .config import BrokerConfig, load_config


@dataclass
class BrokerRuntime:
    config: BrokerConfig
    auth_service: AuthService
    chat_service: ChatService
    agent_service: AgentService


def create_runtime(config: BrokerConfig | None = None) -> BrokerRuntime:
    resolved = config or load_config()
    auth_store = FileSystemSessionStore(
        resolved.auth_store_path,
        prefer_keyring=resolved.prefer_keyring,
    )
    oauth_gateway = OpenAIOAuthGateway(provider=CODEX_OAUTH_PROVIDER)
    callback_server_factory = LoopbackCallbackServerFactory(
        host=CODEX_OAUTH_PROVIDER.bind_host,
        port=CODEX_OAUTH_PROVIDER.redirect_port,
        callback_path=CODEX_OAUTH_PROVIDER.redirect_path,
        cancel_path="/auth/cancel",
        timeout_seconds=resolved.login_timeout_ms / 1000,
    )
    auth_service = AuthService(
        session_store=auth_store,
        oauth_gateway=oauth_gateway,
        callback_server_factory=callback_server_factory,
        login_timeout_ms=resolved.login_timeout_ms,
        min_refresh_delay_ms=resolved.min_refresh_delay_ms,
    )
    auth_service.initialize()

    codex_gateway = CodexHttpGateway(
        base_url=resolved.codex_base_url,
        user_agent=resolved.user_agent,
    )
    chat_service = ChatService(
        auth_service=auth_service,
        codex_gateway=codex_gateway,
    )
    agent_service = AgentService(
        chat_service=chat_service,
        tools=[ReadFileTool(), WriteFileTool(), ShellTool()],
        workspace_root=Path.cwd(),
    )

    return BrokerRuntime(
        config=resolved,
        auth_service=auth_service,
        chat_service=chat_service,
        agent_service=agent_service,
    )
