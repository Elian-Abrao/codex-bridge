import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { AuthStateSnapshot, StartLoginResult } from "../../shared/auth.js";
import { buildAuthorizeUrl, buildRedirectUri, buildTokenUrl, CODEX_OAUTH_PROVIDER, type OAuthProviderDefinition } from "./provider-definitions.js";
import { extractJwtExpiryMs, extractOpenAiAccountId, extractOpenAiEmail, extractOpenAiPlanType } from "./jwt.js";
import { LocalCallbackServer, parseManualCallbackInput, type CallbackPayload } from "./callback-server.js";
import { generateOAuthState, generatePkcePair, toFormUrlEncoded, type PkcePair } from "./pkce.js";
import { AuthSessionStore, toPublicSession, type StoredAuthSession } from "./session-store.js";

const ACCESS_TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const MIN_REFRESH_DELAY_MS = 15_000;
const FALLBACK_EXPIRY_MS = 55 * 60 * 1000;

type TokenExchangeResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
};

type PendingLogin = {
  id: string;
  state: string;
  pkce: PkcePair;
  provider: OAuthProviderDefinition;
  redirectUri: string;
  authUrl: string;
  startedAt: number;
  expiresAt: number;
  callbackServer?: LocalCallbackServer;
  timeoutHandle?: NodeJS.Timeout;
  completionPromise?: Promise<void>;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`OAuth response is missing ${field}.`);
  }
  return value;
}

function resolveExpiryTimestamp(params: {
  now: number;
  expiresInSeconds?: number;
  accessToken?: string;
  idToken?: string;
}): number {
  const explicitExpiry =
    typeof params.expiresInSeconds === "number" && Number.isFinite(params.expiresInSeconds)
      ? params.now + params.expiresInSeconds * 1000 - ACCESS_TOKEN_EXPIRY_BUFFER_MS
      : undefined;

  const jwtExpiry =
    extractJwtExpiryMs(params.accessToken) ?? extractJwtExpiryMs(params.idToken);

  return Math.max(
    explicitExpiry ?? (jwtExpiry ? jwtExpiry - ACCESS_TOKEN_EXPIRY_BUFFER_MS : params.now + FALLBACK_EXPIRY_MS),
    params.now + 30_000
  );
}

function buildStateSnapshot(params: {
  activeLogin?: PendingLogin;
  session?: StoredAuthSession;
  isRefreshing: boolean;
}): AuthStateSnapshot {
  return {
    activeLogin: params.activeLogin
      ? {
          provider: params.activeLogin.provider.id,
          authUrl: params.activeLogin.authUrl,
          redirectUri: params.activeLogin.redirectUri,
          expiresAt: params.activeLogin.expiresAt,
          startedAt: params.activeLogin.startedAt,
          manualFallback: true
        }
      : undefined,
    session: params.session ? toPublicSession(params.session) : undefined,
    isRefreshing: params.isRefreshing
  };
}

export type AuthServiceEvents = {
  "state-changed": [AuthStateSnapshot];
};

export type AuthServiceOptions = {
  sessionStore: AuthSessionStore;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export class AuthService extends EventEmitter<AuthServiceEvents> {
  readonly #sessionStore: AuthSessionStore;
  readonly #fetchImpl: typeof fetch;
  readonly #now: () => number;

  #activeLogin?: PendingLogin;
  #refreshTimer?: NodeJS.Timeout;
  #refreshPromise?: Promise<void>;
  #session?: StoredAuthSession;

  constructor(options: AuthServiceOptions) {
    super();
    this.#sessionStore = options.sessionStore;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#now = options.now ?? (() => Date.now());
  }

  async initialize(): Promise<void> {
    this.#session = await this.#sessionStore.load();
    if (this.#session) {
      this.scheduleRefresh(this.#session);
    }
    this.emitStateChanged();
  }

  getState(): AuthStateSnapshot {
    return buildStateSnapshot({
      activeLogin: this.#activeLogin,
      session: this.#session,
      isRefreshing: Boolean(this.#refreshPromise)
    });
  }

  async startLogin(openUrl?: (url: string) => Promise<void>): Promise<StartLoginResult> {
    if (this.#activeLogin) {
      return buildStateSnapshot({
        activeLogin: this.#activeLogin,
        session: this.#session,
        isRefreshing: Boolean(this.#refreshPromise)
      }).activeLogin as StartLoginResult;
    }

    const provider = CODEX_OAUTH_PROVIDER;
    const pkce = generatePkcePair();
    const state = generateOAuthState();
    const redirectUri = buildRedirectUri(provider);
    const authUrl = buildAuthorizeUrl({ provider, pkce, state });
    const startedAt = this.#now();
    const expiresAt = startedAt + LOGIN_TIMEOUT_MS;

    const pending: PendingLogin = {
      id: randomUUID(),
      state,
      pkce,
      provider,
      redirectUri,
      authUrl,
      startedAt,
      expiresAt
    };

    pending.timeoutHandle = setTimeout(() => {
      if (this.#activeLogin?.id !== pending.id) {
        return;
      }
      void this.clearPendingLogin(pending.id);
    }, LOGIN_TIMEOUT_MS);

    try {
      pending.callbackServer = new LocalCallbackServer({
        host: provider.bindHost,
        port: provider.redirectPort,
        callbackPath: provider.redirectPath,
        cancelPath: "/auth/cancel",
        expectedState: state,
        timeoutMs: LOGIN_TIMEOUT_MS,
        successTitle: "Access granted",
        successMessage: "codex-bridge is now authorized. You can return to your terminal or app and continue."
      });
      await pending.callbackServer.start();
      void pending.callbackServer.waitForCompletion().then((payload) => {
        void this.finishLoginFromCallback(pending.id, payload);
      }).catch(() => {
        // Timeout and cancellation are handled by the flow timer or the manual fallback.
      });
    } catch {
      // Manual fallback remains available even if the loopback callback cannot bind.
    }

    this.#activeLogin = pending;
    this.emitStateChanged();

    if (openUrl) {
      await openUrl(authUrl);
    }

    return {
      provider: pending.provider.id,
      authUrl: pending.authUrl,
      redirectUri: pending.redirectUri,
      expiresAt: pending.expiresAt,
      manualFallback: true
    };
  }

  async completeManualLogin(redirectUrl: string): Promise<void> {
    const pending = this.#activeLogin;
    if (!pending) {
      throw new Error("There is no active OAuth login to complete.");
    }

    const payload = parseManualCallbackInput(redirectUrl, pending.state);
    await this.finishLoginFromCallback(pending.id, payload);
  }

  async logout(): Promise<void> {
    this.clearRefreshTimer();
    if (this.#activeLogin?.timeoutHandle) {
      clearTimeout(this.#activeLogin.timeoutHandle);
    }
    await this.#activeLogin?.callbackServer?.close().catch(() => undefined);
    this.#activeLogin = undefined;
    this.#session = undefined;
    await this.#sessionStore.clear();
    this.emitStateChanged();
  }

  async getValidSession(): Promise<StoredAuthSession> {
    if (!this.#session) {
      throw new Error("No authenticated Codex session is available.");
    }

    if (this.#session.expiresAt <= this.#now()) {
      await this.refreshSession();
    }

    if (!this.#session) {
      throw new Error("No authenticated Codex session is available.");
    }

    return this.#session;
  }

  async refreshSession(): Promise<void> {
    if (!this.#session) {
      throw new Error("No authenticated Codex session is available.");
    }

    if (this.#refreshPromise) {
      await this.#refreshPromise;
      return;
    }

    const current = this.#session;
    this.#refreshPromise = (async () => {
      try {
        const refreshed = await this.refreshCodexSession(current);
        this.#session = refreshed;
        await this.#sessionStore.save(refreshed);
        this.scheduleRefresh(refreshed);
      } finally {
        this.#refreshPromise = undefined;
        this.emitStateChanged();
      }
    })();

    this.emitStateChanged();
    await this.#refreshPromise;
  }

  private async finishLoginFromCallback(loginId: string, payload: CallbackPayload): Promise<void> {
    const pending = this.#activeLogin;
    if (!pending || pending.id !== loginId) {
      return;
    }

    if (pending.completionPromise) {
      await pending.completionPromise;
      return;
    }

    pending.completionPromise = (async () => {
      try {
        const session = await this.exchangeAuthorizationCode(pending, payload.code);
        this.#session = session;
        await this.#sessionStore.save(session);
        this.scheduleRefresh(session);
      } finally {
        await this.clearPendingLogin(loginId);
      }
    })();

    await pending.completionPromise;
    this.emitStateChanged();
  }

  private async exchangeAuthorizationCode(
    pending: PendingLogin,
    code: string
  ): Promise<StoredAuthSession> {
    const response = await this.#fetchImpl(buildTokenUrl(pending.provider), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json"
      },
      body: toFormUrlEncoded({
        grant_type: "authorization_code",
        code,
        redirect_uri: pending.redirectUri,
        client_id: pending.provider.clientId,
        code_verifier: pending.pkce.verifier
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth token exchange failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as TokenExchangeResponse;
    const now = this.#now();
    const accessToken = requireString(payload.access_token, "access_token");
    const refreshToken = requireString(payload.refresh_token, "refresh_token");
    const accountId =
      extractOpenAiAccountId(accessToken) ??
      extractOpenAiAccountId(payload.id_token);

    return {
      provider: pending.provider.id,
      accessToken,
      refreshToken,
      idToken: payload.id_token,
      accountId,
      email: extractOpenAiEmail(payload.id_token),
      planType: extractOpenAiPlanType(payload.id_token),
      expiresAt: resolveExpiryTimestamp({
        now,
        expiresInSeconds: payload.expires_in,
        accessToken,
        idToken: payload.id_token
      }),
      updatedAt: now
    };
  }

  private async refreshCodexSession(session: StoredAuthSession): Promise<StoredAuthSession> {
    const response = await this.#fetchImpl(buildTokenUrl(CODEX_OAUTH_PROVIDER), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: CODEX_OAUTH_PROVIDER.clientId,
        grant_type: "refresh_token",
        refresh_token: session.refreshToken
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OAuth refresh failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as TokenExchangeResponse;
    const now = this.#now();
    const accessToken = requireString(payload.access_token, "access_token");
    const idToken = payload.id_token ?? session.idToken;
    const accountId =
      extractOpenAiAccountId(accessToken) ??
      extractOpenAiAccountId(idToken) ??
      session.accountId;

    return {
      ...session,
      accessToken,
      refreshToken: payload.refresh_token ?? session.refreshToken,
      idToken,
      accountId,
      email: extractOpenAiEmail(idToken) ?? session.email,
      planType: extractOpenAiPlanType(idToken) ?? session.planType,
      expiresAt: resolveExpiryTimestamp({
        now,
        expiresInSeconds: payload.expires_in,
        accessToken,
        idToken
      }),
      updatedAt: now
    };
  }

  private scheduleRefresh(session: StoredAuthSession): void {
    this.clearRefreshTimer();
    const delayMs = Math.max(MIN_REFRESH_DELAY_MS, session.expiresAt - this.#now());
    this.#refreshTimer = setTimeout(() => {
      void this.refreshSession().catch(() => undefined);
    }, delayMs);
    this.emitStateChanged();
  }

  private clearRefreshTimer(): void {
    if (this.#refreshTimer) {
      clearTimeout(this.#refreshTimer);
      this.#refreshTimer = undefined;
    }
  }

  private async clearPendingLogin(loginId: string): Promise<void> {
    const pending = this.#activeLogin;
    if (!pending || pending.id !== loginId) {
      return;
    }

    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle);
    }
    await pending.callbackServer?.close().catch(() => undefined);
    if (this.#activeLogin?.id === loginId) {
      this.#activeLogin = undefined;
    }
    this.emitStateChanged();
  }

  private emitStateChanged(): void {
    this.emit("state-changed", this.getState());
  }
}
