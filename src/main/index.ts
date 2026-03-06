import { app } from "electron";
import { join } from "node:path";
import { AuthService } from "./auth/auth-service.js";
import { AuthSessionStore } from "./auth/session-store.js";
import { registerIpcHandlers } from "./ipc/register-ipc.js";
import { ProviderFacade } from "./network/facade.js";
import type { ProviderRuntimeConfig } from "./network/provider-registry.js";
import { CodexProviderAdapter } from "./network/providers/codex-provider.js";
import { GeminiProviderAdapter } from "./network/providers/gemini-provider.js";
import { OpenAiProviderAdapter } from "./network/providers/openai-provider.js";

export type ElectronBridgeRuntime = {
  authService: AuthService;
  providerFacade: ProviderFacade;
  dispose: () => void;
};

export async function createElectronBridgeRuntime(
  config?: ProviderRuntimeConfig
): Promise<ElectronBridgeRuntime> {
  const sessionStore = new AuthSessionStore(
    join(app.getPath("userData"), "auth", "codex-session.json")
  );

  const authService = new AuthService({ sessionStore });
  await authService.initialize();

  const providerFacade = new ProviderFacade({
    authService,
    config,
    adapters: [
      new CodexProviderAdapter(),
      new OpenAiProviderAdapter(),
      new GeminiProviderAdapter()
    ]
  });

  const dispose = registerIpcHandlers({ authService, providerFacade });
  return {
    authService,
    providerFacade,
    dispose
  };
}
