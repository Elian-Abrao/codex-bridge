import { startBridgeHttpServer } from "../server/http-server.js";
import { createBridgeRuntime } from "../server/runtime.js";
import { DEFAULT_BRIDGE_MODEL } from "../shared/bridge.js";

function readHost(): string | undefined {
  const raw = process.env.CODEX_BRIDGE_HOST?.trim();
  return raw || undefined;
}

function readPort(): number | undefined {
  const raw = process.env.CODEX_BRIDGE_PORT?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function main(): Promise<void> {
  const runtime = await createBridgeRuntime({
    host: readHost(),
    port: readPort(),
    authStorePath: process.env.CODEX_BRIDGE_AUTH_STORE_PATH?.trim() || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    codexBaseUrl: process.env.CODEX_BASE_URL,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    geminiBaseUrl: process.env.GEMINI_BASE_URL,
    model: process.env.CODEX_BRIDGE_MODEL
  });

  const started = await startBridgeHttpServer({
    authService: runtime.authService,
    providerFacade: runtime.providerFacade,
    config: {
      host: readHost(),
      port: readPort(),
      model: process.env.CODEX_BRIDGE_MODEL
    }
  });

  process.stdout.write(`codex-bridge listening on ${started.baseUrl}\n`);
  process.stdout.write("auth: POST /v1/auth/login | GET /v1/auth/state | POST /v1/auth/complete | POST /v1/auth/logout\n");
  process.stdout.write(
    `chat: POST /v1/chat | POST /v1/chat/stream (provider defaults to codex, model defaults to ${process.env.CODEX_BRIDGE_MODEL?.trim() || DEFAULT_BRIDGE_MODEL})\n`
  );
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
