import type { PkcePair } from "./pkce.js";

export const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const CODEX_ORIGINATOR = "codex_cli_rs";
export const OPENAI_AUTH_ISSUER = "https://auth.openai.com";

export type OAuthProviderDefinition = {
  id: "codex";
  clientId: string;
  issuer: string;
  bindHost: string;
  redirectHost: string;
  redirectPort: number;
  redirectPath: string;
  scopes: string[];
  authorizeExtraParams: Record<string, string>;
};

export const CODEX_OAUTH_PROVIDER: OAuthProviderDefinition = {
  id: "codex",
  clientId: CODEX_CLIENT_ID,
  issuer: OPENAI_AUTH_ISSUER,
  bindHost: "127.0.0.1",
  redirectHost: "localhost",
  redirectPort: 1455,
  redirectPath: "/auth/callback",
  scopes: [
    "openid",
    "profile",
    "email",
    "offline_access",
    "api.connectors.read",
    "api.connectors.invoke"
  ],
  authorizeExtraParams: {
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: CODEX_ORIGINATOR
  }
};

export function buildRedirectUri(provider: OAuthProviderDefinition): string {
  return `http://${provider.redirectHost}:${provider.redirectPort}${provider.redirectPath}`;
}

export function buildAuthorizeUrl(params: {
  provider: OAuthProviderDefinition;
  pkce: PkcePair;
  state: string;
}): string {
  const { provider, pkce, state } = params;
  const query = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: buildRedirectUri(provider),
    scope: provider.scopes.join(" "),
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    state,
    ...provider.authorizeExtraParams
  });
  return `${provider.issuer}/oauth/authorize?${query.toString()}`;
}

export function buildTokenUrl(provider: OAuthProviderDefinition): string {
  return `${provider.issuer}/oauth/token`;
}
