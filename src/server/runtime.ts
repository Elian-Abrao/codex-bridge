import { homedir } from "node:os";
import { join } from "node:path";
import { AuthService } from "../main/auth/auth-service.js";
import { AuthSessionStore } from "../main/auth/session-store.js";
import { ProviderFacade } from "../main/network/facade.js";
import { CodexProviderAdapter } from "../main/network/providers/codex-provider.js";
import { GeminiProviderAdapter } from "../main/network/providers/gemini-provider.js";
import { OpenAiProviderAdapter } from "../main/network/providers/openai-provider.js";
import type { ProviderRuntimeConfig } from "../main/network/provider-registry.js";
import { DEFAULT_BRIDGE_MODEL } from "../shared/bridge.js";
import type { BridgeServerConfig } from "./types.js";

export type BridgeRuntime = {
  authService: AuthService;
  providerFacade: ProviderFacade;
};

export async function createBridgeRuntime(config?: BridgeServerConfig): Promise<BridgeRuntime> {
  const authStorePath =
    config?.authStorePath ?? join(homedir(), ".codex-bridge", "auth", "codex-session.json");

  const runtimeConfig: ProviderRuntimeConfig = {
    codex: config?.codexBaseUrl
      ? {
          baseUrl: config.codexBaseUrl,
          userAgent: `codex-bridge/${config?.model?.trim() || DEFAULT_BRIDGE_MODEL}`
        }
      : {
          userAgent: `codex-bridge/${config?.model?.trim() || DEFAULT_BRIDGE_MODEL}`
        },
    openai:
      config?.openaiApiKey || config?.openaiBaseUrl
        ? {
            apiKey: config.openaiApiKey,
            baseUrl: config.openaiBaseUrl
          }
        : undefined,
    gemini:
      config?.geminiApiKey || config?.geminiBaseUrl
        ? {
            apiKey: config.geminiApiKey,
            baseUrl: config.geminiBaseUrl
          }
        : undefined
  };

  const authService = new AuthService({
    sessionStore: new AuthSessionStore(authStorePath)
  });
  await authService.initialize();

  const providerFacade = new ProviderFacade({
    authService,
    config: runtimeConfig,
    adapters: [new CodexProviderAdapter(), new OpenAiProviderAdapter(), new GeminiProviderAdapter()]
  });

  return { authService, providerFacade };
}
