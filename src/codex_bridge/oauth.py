from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

from .config import CODEX_CLIENT_ID, CODEX_ORIGINATOR, OPENAI_AUTH_ISSUER


@dataclass(frozen=True)
class OAuthProviderDefinition:
    id: str
    client_id: str
    issuer: str
    bind_host: str
    redirect_host: str
    redirect_port: int
    redirect_path: str
    scopes: tuple[str, ...]
    authorize_extra_params: dict[str, str]


CODEX_OAUTH_PROVIDER = OAuthProviderDefinition(
    id="codex",
    client_id=CODEX_CLIENT_ID,
    issuer=OPENAI_AUTH_ISSUER,
    bind_host="127.0.0.1",
    redirect_host="localhost",
    redirect_port=1455,
    redirect_path="/auth/callback",
    scopes=(
        "openid",
        "profile",
        "email",
        "offline_access",
        "api.connectors.read",
        "api.connectors.invoke",
    ),
    authorize_extra_params={
        "id_token_add_organizations": "true",
        "codex_cli_simplified_flow": "true",
        "originator": CODEX_ORIGINATOR,
    },
)


def build_redirect_uri(provider: OAuthProviderDefinition) -> str:
    return f"http://{provider.redirect_host}:{provider.redirect_port}{provider.redirect_path}"


def build_authorize_url(provider: OAuthProviderDefinition, challenge: str, state: str) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": provider.client_id,
            "redirect_uri": build_redirect_uri(provider),
            "scope": " ".join(provider.scopes),
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": state,
            **provider.authorize_extra_params,
        }
    )
    return f"{provider.issuer}/oauth/authorize?{query}"


def build_token_url(provider: OAuthProviderDefinition) -> str:
    return f"{provider.issuer}/oauth/token"
