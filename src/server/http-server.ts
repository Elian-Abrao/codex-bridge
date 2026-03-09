import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { StartLoginResult } from "../shared/auth.js";
import {
  BRIDGE_API_PREFIX,
  BRIDGE_SERVICE_NAME,
  DEFAULT_BRIDGE_REASONING_EFFORT,
  DEFAULT_CODEX_MODELS,
  DEFAULT_CODEX_REASONING_EFFORTS,
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_MODEL,
  DEFAULT_BRIDGE_PORT,
  normalizeCodexBridgeModel,
  normalizeCodexReasoningEffort,
  type BridgeChatRequest,
  type BridgeChatResponse,
  type BridgeCodexCapabilitiesResponse,
  type BridgeCompleteLoginRequest,
  type BridgeHealthResponse,
  type BridgeLoginResponse
} from "../shared/bridge.js";
import type { StreamEvent, StreamRequest } from "../shared/network.js";
import type { AuthService } from "../main/auth/auth-service.js";
import type { ProviderFacade } from "../main/network/facade.js";
import { runBridgeChat } from "./chat.js";
import type { BridgeServerConfig } from "./types.js";

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(payload)}\n`);
}

function writeText(res: ServerResponse, statusCode: number, body: string): void {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function isRoutePath(pathname: string, routePath: string): boolean {
  return pathname === routePath || pathname === `${BRIDGE_API_PREFIX}${routePath}`;
}

async function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function toStreamRequest(body: BridgeChatRequest, fallbackModel: string): StreamRequest {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    throw new Error("`messages` must contain at least one chat message.");
  }

  const provider = body.provider ?? "codex";
  const requestedModel = body.model?.trim() || fallbackModel;
  const resolvedModel = provider === "codex"
    ? normalizeCodexBridgeModel(requestedModel)
    : requestedModel;
  const resolvedReasoningEffort = provider === "codex"
    ? normalizeCodexReasoningEffort(body.reasoningEffort)
    : body.reasoningEffort;

  return {
    requestId: randomUUID(),
    provider,
    model: resolvedModel,
    messages,
    reasoningEffort: resolvedReasoningEffort,
    temperature: body.temperature,
    metadata: body.metadata
  };
}

function buildCodexCapabilities(params: {
  authService: AuthService;
  defaultModel: string;
}): BridgeCodexCapabilitiesResponse {
  const authState = params.authService.getState();
  const accountEmail = authState.session?.email;

  return {
    provider: "codex",
    billingMode: "monthly",
    requiresAuth: true,
    authenticated: Boolean(authState.session),
    accountEmail,
    defaultModel: params.defaultModel,
    defaultReasoningEffort: DEFAULT_BRIDGE_REASONING_EFFORT,
    models: DEFAULT_CODEX_MODELS,
    reasoningEfforts: DEFAULT_CODEX_REASONING_EFFORTS
  };
}

async function handleChatStream(params: {
  req: IncomingMessage;
  res: ServerResponse;
  providerFacade: ProviderFacade;
  defaultModel: string;
}): Promise<void> {
  const body = await readJsonBody<BridgeChatRequest>(params.req);
  const request = toStreamRequest(body, params.defaultModel);

  params.res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  const stream = await params.providerFacade.stream({
    request,
    onEvent: async (event: StreamEvent) => {
      params.res.write(`event: ${event.kind}\n`);
      params.res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  });

  params.req.once("close", () => {
    stream.abort();
  });
  params.res.once("close", () => {
    stream.abort();
  });

  try {
    await stream.completed;
  } finally {
    if (!params.res.writableEnded) {
      params.res.end();
    }
  }
}

async function handleLogin(res: ServerResponse, authService: AuthService): Promise<void> {
  const login = await authService.startLogin();
  writeJson(res, 200, {
    ...login,
    instructions: [
      "Abra authUrl no seu navegador.",
      "Se o callback automatico falhar, envie a URL final em POST /v1/auth/complete."
    ]
  } satisfies BridgeLoginResponse);
}

async function handleChat(params: {
  req: IncomingMessage;
  res: ServerResponse;
  providerFacade: ProviderFacade;
  defaultModel: string;
}): Promise<void> {
  const body = await readJsonBody<BridgeChatRequest>(params.req);
  const request = toStreamRequest(body, params.defaultModel);
  const response = await runBridgeChat({
    providerFacade: params.providerFacade,
    request
  });
  writeJson(params.res, 200, response satisfies BridgeChatResponse);
}

export async function startBridgeHttpServer(params: {
  authService: AuthService;
  providerFacade: ProviderFacade;
  config?: BridgeServerConfig;
}): Promise<{ server: Server; host: string; port: number; baseUrl: string }> {
  const host = params.config?.host ?? DEFAULT_BRIDGE_HOST;
  const port = params.config?.port ?? DEFAULT_BRIDGE_PORT;
  const defaultModel = params.config?.model?.trim() || DEFAULT_BRIDGE_MODEL;

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const method = req.method ?? "GET";
        const url = new URL(req.url ?? "/", `http://${host}:${port}`);

        if (method === "GET" && isRoutePath(url.pathname, "/health")) {
          writeJson(
            res,
            200,
            {
              ok: true,
              service: BRIDGE_SERVICE_NAME
            } satisfies BridgeHealthResponse
          );
          return;
        }

        if (method === "GET" && isRoutePath(url.pathname, "/auth/state")) {
          writeJson(res, 200, params.authService.getState());
          return;
        }

        if (method === "GET" && isRoutePath(url.pathname, "/providers/codex/options")) {
          writeJson(
            res,
            200,
            buildCodexCapabilities({
              authService: params.authService,
              defaultModel
            })
          );
          return;
        }

        if (method === "POST" && isRoutePath(url.pathname, "/auth/login")) {
          await handleLogin(res, params.authService);
          return;
        }

        if (method === "POST" && isRoutePath(url.pathname, "/auth/complete")) {
          const body = await readJsonBody<BridgeCompleteLoginRequest>(req);
          if (!body.redirectUrl?.trim()) {
            writeJson(res, 400, { error: "`redirectUrl` is required." });
            return;
          }
          await params.authService.completeManualLogin(body.redirectUrl);
          writeJson(res, 200, params.authService.getState());
          return;
        }

        if (method === "POST" && isRoutePath(url.pathname, "/auth/logout")) {
          await params.authService.logout();
          writeJson(res, 200, { ok: true });
          return;
        }

        if (method === "POST" && isRoutePath(url.pathname, "/chat")) {
          await handleChat({
            req,
            res,
            providerFacade: params.providerFacade,
            defaultModel
          });
          return;
        }

        if (method === "POST" && isRoutePath(url.pathname, "/chat/stream")) {
          await handleChatStream({
            req,
            res,
            providerFacade: params.providerFacade,
            defaultModel
          });
          return;
        }

        writeText(res, 404, "Not found.");
      } catch (error) {
        if (!res.headersSent) {
          writeJson(res, 500, {
            error: error instanceof Error ? error.message : String(error)
          });
        } else if (!res.writableEnded) {
          res.end();
        }
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return {
    server,
    host,
    port,
    baseUrl: `http://${host}:${port}`
  };
}
