export type ProviderId = "codex" | "openai" | "gemini";

export type PkceProviderId = "codex";

export type AuthStateEvent = {
  state: AuthStateSnapshot;
};

export type StartLoginResult = {
  provider: PkceProviderId;
  authUrl: string;
  redirectUri: string;
  expiresAt: number;
  manualFallback: boolean;
};

export type PublicAuthSession = {
  provider: PkceProviderId;
  accountId?: string;
  email?: string;
  planType?: string;
  expiresAt: number;
  updatedAt: number;
};

export type AuthStateSnapshot = {
  activeLogin?: StartLoginResult & {
    startedAt: number;
  };
  session?: PublicAuthSession;
  isRefreshing: boolean;
};
