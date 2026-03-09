from __future__ import annotations

from dataclasses import dataclass
from os import getenv
from pathlib import Path


BRIDGE_SERVICE_NAME = "codex-bridge"
BRIDGE_API_PREFIX = "/v1"
DEFAULT_BIND_HOST = "127.0.0.1"
DEFAULT_BIND_PORT = 47831
DEFAULT_CODEX_MODEL = "gpt-5.4"
DEFAULT_REASONING_EFFORT = "medium"
DEFAULT_CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex"
DEFAULT_USER_AGENT = "codex-bridge/python"
KEYRING_SERVICE_NAME = "codex-bridge"
KEYRING_USERNAME = "default"
OPENAI_AUTH_ISSUER = "https://auth.openai.com"
CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
CODEX_ORIGINATOR = "codex_cli_rs"
ACCESS_TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000
LOGIN_TIMEOUT_MS = 5 * 60 * 1000
MIN_REFRESH_DELAY_MS = 15_000
FALLBACK_EXPIRY_MS = 55 * 60 * 1000

DEFAULT_CODEX_MODELS = [
    {
        "id": "gpt-5.4",
        "label": "gpt-5.4",
        "description": "Balanced default for Codex-backed chat workflows.",
        "recommended": True,
    },
    {
        "id": "gpt-5",
        "label": "gpt-5",
        "description": "General-purpose GPT-5 model for broader compatibility.",
    },
    {
        "id": "gpt-5-mini",
        "label": "gpt-5-mini",
        "description": "Lower-latency GPT-5 option for lighter tasks.",
    },
]


def default_auth_store_path() -> Path:
    return Path.home() / ".codex-bridge" / "auth" / "codex-session.json"


@dataclass(frozen=True)
class BrokerConfig:
    bind_host: str = DEFAULT_BIND_HOST
    bind_port: int = DEFAULT_BIND_PORT
    auth_store_path: Path = default_auth_store_path()
    codex_base_url: str = DEFAULT_CODEX_BASE_URL
    user_agent: str = DEFAULT_USER_AGENT
    prefer_keyring: bool = True


def load_config(
    *,
    host: str | None = None,
    port: int | None = None,
    auth_store_path: str | None = None,
    codex_base_url: str | None = None,
    user_agent: str | None = None,
    prefer_keyring: bool | None = None,
) -> BrokerConfig:
    raw_port = str(port or getenv("CODEX_BRIDGE_PORT", "")).strip()
    parsed_port = DEFAULT_BIND_PORT
    if raw_port:
        try:
            parsed_port = int(raw_port)
        except ValueError:
            parsed_port = DEFAULT_BIND_PORT

    raw_store_path = auth_store_path or getenv("CODEX_BRIDGE_AUTH_STORE_PATH", "")
    store_path = Path(raw_store_path).expanduser() if raw_store_path.strip() else default_auth_store_path()

    return BrokerConfig(
        bind_host=(host or getenv("CODEX_BRIDGE_HOST", "")).strip() or DEFAULT_BIND_HOST,
        bind_port=parsed_port,
        auth_store_path=store_path,
        codex_base_url=(codex_base_url or getenv("CODEX_BASE_URL", "")).strip() or DEFAULT_CODEX_BASE_URL,
        user_agent=(user_agent or getenv("CODEX_BRIDGE_USER_AGENT", "")).strip() or DEFAULT_USER_AGENT,
        prefer_keyring=(
            prefer_keyring
            if prefer_keyring is not None
            else getenv("CODEX_BRIDGE_DISABLE_KEYRING", "").strip() not in {"1", "true", "yes"}
        ),
    )


def normalize_codex_base_url(base_url: str) -> str:
    trimmed = base_url.rstrip("/")
    if (
        (trimmed.startswith("https://chatgpt.com") or trimmed.startswith("https://chat.openai.com"))
        and "/backend-api/codex" not in trimmed
    ):
        return f"{trimmed}/backend-api/codex"
    return trimmed


def normalize_codex_model(model: str | None) -> str:
    normalized = (model or "").strip()
    if not normalized or normalized == "gpt-5-nano":
        return DEFAULT_CODEX_MODEL
    return normalized


def normalize_reasoning_effort(effort: str | None) -> str:
    normalized = (effort or "").strip().lower()
    if not normalized:
        return DEFAULT_REASONING_EFFORT
    if normalized == "minimal":
        return "low"
    if normalized in {"none", "low", "medium", "high", "xhigh"}:
        return normalized
    return DEFAULT_REASONING_EFFORT

DEFAULT_CODEX_REASONING_EFFORTS = [
    {
        "id": "none",
        "label": "None",
        "description": "Fastest profile with reasoning effectively disabled.",
    },
    {
        "id": "low",
        "label": "Low",
        "description": "Light reasoning for straightforward tasks.",
    },
    {
        "id": "medium",
        "label": "Medium",
        "description": "Balanced reasoning depth for most requests.",
        "recommended": True,
    },
    {
        "id": "high",
        "label": "High",
        "description": "More deliberate reasoning for harder prompts.",
    },
    {
        "id": "xhigh",
        "label": "XHigh",
        "description": "Maximum reasoning depth for the hardest prompts.",
    },
]
