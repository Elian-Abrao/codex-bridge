import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createBridgeClient } from "../client/index.js";
import { startBridgeHttpServer } from "../server/http-server.js";
import { createBridgeRuntime } from "../server/runtime.js";
import {
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_MODEL,
  DEFAULT_BRIDGE_PORT
} from "../shared/bridge.js";
import type { AuthStateSnapshot } from "../shared/auth.js";
import type { ChatMessage } from "../shared/network.js";

type OwnedBridgeServer = {
  close: () => Promise<void>;
};

function readBaseUrl(): string {
  return process.env.CODEX_BRIDGE_URL?.trim() || `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;
}

function readPort(url: URL): number {
  if (!url.port) {
    return DEFAULT_BRIDGE_PORT;
  }

  const parsed = Number.parseInt(url.port, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BRIDGE_PORT;
}

function tryOpenExternal(url: string): boolean {
  const command =
    process.platform === "darwin"
      ? { cmd: "open", args: [url] }
      : process.platform === "win32"
        ? { cmd: "cmd", args: ["/c", "start", "", url] }
        : { cmd: "xdg-open", args: [url] };

  try {
    const child = spawn(command.cmd, command.args, {
      detached: true,
      stdio: "ignore"
    });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureBridgeAvailable(baseUrl: string): Promise<OwnedBridgeServer | undefined> {
  const client = createBridgeClient({ baseUrl });
  try {
    await client.health();
    return undefined;
  } catch {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:") {
      throw new Error("The interactive CLI can only auto-start an HTTP bridge.");
    }

    const runtime = await createBridgeRuntime({
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
        host: url.hostname || DEFAULT_BRIDGE_HOST,
        port: readPort(url),
        model: process.env.CODEX_BRIDGE_MODEL
      }
    });

    output.write(`codex-bridge auto-started on ${started.baseUrl}\n`);

    return {
      close: async () =>
        await new Promise<void>((resolve, reject) => {
          started.server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        })
    };
  }
}

async function waitForSession(baseUrl: string, expiresAt: number): Promise<AuthStateSnapshot> {
  const client = createBridgeClient({ baseUrl });

  while (Date.now() < expiresAt) {
    const state = await client.getAuthState();
    if (state.session) {
      return state;
    }

    if (!state.activeLogin) {
      return state;
    }

    await sleep(1_000);
  }

  return client.getAuthState();
}

async function ensureAuthenticated(baseUrl: string): Promise<AuthStateSnapshot> {
  const client = createBridgeClient({ baseUrl });
  const current = await client.getAuthState();
  if (current.session) {
    return current;
  }

  const rl = createInterface({ input, output });
  try {
    const login = await client.startLogin();
    const opened = tryOpenExternal(login.authUrl);

    output.write("Nenhuma sessao Codex encontrada.\n");
    output.write(`${opened ? "O navegador foi aberto automaticamente." : "Abra esta URL no navegador:"}\n`);
    output.write(`${login.authUrl}\n`);
    output.write(`Redirect esperado: ${login.redirectUri}\n`);

    const callback = (
      await rl.question(
        "Pressione Enter quando concluir o login. Se o callback automatico falhar, cole aqui a URL final de redirect: "
      )
    ).trim();

    if (callback) {
      await client.completeLogin(callback);
      return client.getAuthState();
    }

    const finalState = await waitForSession(baseUrl, login.expiresAt);
    if (!finalState.session) {
      throw new Error("O login nao foi concluido dentro do tempo limite.");
    }

    return finalState;
  } finally {
    rl.close();
  }
}

function printHelp(): void {
  output.write("Comandos: /help /reset /model <nome> /logout /exit\n");
}

async function main(): Promise<void> {
  const baseUrl = readBaseUrl();
  const ownedServer = await ensureBridgeAvailable(baseUrl);
  const client = createBridgeClient({ baseUrl });

  try {
    const state = await ensureAuthenticated(baseUrl);
    output.write(
      `Sessao ativa${state.session?.email ? ` para ${state.session.email}` : ""}. Modelo padrao: ${process.env.CODEX_BRIDGE_MODEL?.trim() || DEFAULT_BRIDGE_MODEL}\n`
    );
    printHelp();

    const rl = createInterface({ input, output });
    const history: ChatMessage[] = [];
    let model = process.env.CODEX_BRIDGE_MODEL?.trim() || DEFAULT_BRIDGE_MODEL;

    try {
      while (true) {
        const line = (await rl.question("codex> ")).trim();
        if (!line) {
          continue;
        }

        if (line === "/exit") {
          break;
        }

        if (line === "/help") {
          printHelp();
          continue;
        }

        if (line === "/reset") {
          history.length = 0;
          output.write("Contexto limpo.\n");
          continue;
        }

        if (line === "/logout") {
          await client.logout();
          history.length = 0;
          await ensureAuthenticated(baseUrl);
          output.write("Sessao renovada.\n");
          continue;
        }

        if (line.startsWith("/model ")) {
          const nextModel = line.slice("/model ".length).trim();
          if (!nextModel) {
            output.write("Informe um nome de modelo valido.\n");
            continue;
          }
          model = nextModel;
          output.write(`Modelo atual: ${model}\n`);
          continue;
        }

        history.push({ role: "user", content: line });
        let assistantText = "";
        let failed = false;

        try {
          await client.streamChat(
            {
              model,
              messages: history
            },
            {
              onEvent: (event) => {
                if (event.kind === "status") {
                  output.write(`[status] ${event.message}\n`);
                  return;
                }

                if (event.kind === "delta") {
                  assistantText += event.delta;
                  output.write(event.delta);
                  return;
                }

                if (event.kind === "error") {
                  failed = true;
                }
              }
            }
          );
          output.write("\n\n");
        } catch (error) {
          failed = true;
          output.write(`\n[erro] ${error instanceof Error ? error.message : String(error)}\n\n`);
        }

        if (failed) {
          history.pop();
          continue;
        }

        history.push({ role: "assistant", content: assistantText });
      }
    } finally {
      rl.close();
    }
  } finally {
    await ownedServer?.close().catch(() => undefined);
  }
}

void main().catch((error) => {
  output.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
