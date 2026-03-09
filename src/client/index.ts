import type { AuthStateSnapshot } from "../shared/auth.js";
import {
  BRIDGE_SERVICE_NAME,
  DEFAULT_BRIDGE_HOST,
  DEFAULT_BRIDGE_MODEL,
  DEFAULT_BRIDGE_PORT,
  buildBridgeApiPath,
  type BridgeChatRequest,
  type BridgeChatResponse,
  type BridgeCodexCapabilitiesResponse,
  type BridgeCompleteLoginRequest,
  type BridgeErrorResponse,
  type BridgeHealthResponse,
  type BridgeLoginResponse,
  type BridgeLogoutResponse
} from "../shared/bridge.js";
import type { StreamEvent } from "../shared/network.js";
import { consumeServerSentEvents, type ParsedSseEvent } from "../shared/sse.js";

const DEFAULT_BASE_URL = `http://${DEFAULT_BRIDGE_HOST}:${DEFAULT_BRIDGE_PORT}`;

export type BridgeClientOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type BridgeStreamOptions = {
  signal?: AbortSignal;
  onEvent?: (event: StreamEvent) => Promise<void> | void;
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

async function readErrorMessage(response: Response): Promise<string> {
  const text = (await response.text()).trim();
  if (!text) {
    return `Bridge request failed with status ${response.status}.`;
  }

  try {
    const payload = JSON.parse(text) as BridgeErrorResponse;
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Fall back to the raw body.
  }

  return text;
}

function parseStreamEvent(envelope: ParsedSseEvent): StreamEvent {
  const parsed = JSON.parse(envelope.data) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Bridge stream returned a malformed event.");
  }

  return parsed as StreamEvent;
}

export class CodexBridgeClient {
  readonly #baseUrl: string;
  readonly #fetchImpl: typeof fetch;

  constructor(options?: BridgeClientOptions) {
    this.#baseUrl = trimTrailingSlash(options?.baseUrl?.trim() || DEFAULT_BASE_URL);
    this.#fetchImpl = options?.fetchImpl ?? fetch;
  }

  get baseUrl(): string {
    return this.#baseUrl;
  }

  async health(): Promise<BridgeHealthResponse> {
    const response = await this.#fetchImpl(`${this.#baseUrl}${buildBridgeApiPath("/health")}`);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const payload = (await response.json()) as BridgeHealthResponse;
    if (payload.service !== BRIDGE_SERVICE_NAME) {
      throw new Error(`Unexpected bridge service: ${payload.service}`);
    }
    return payload;
  }

  async getAuthState(): Promise<AuthStateSnapshot> {
    return this.requestJson<AuthStateSnapshot>("GET", buildBridgeApiPath("/auth/state"));
  }

  async startLogin(): Promise<BridgeLoginResponse> {
    return this.requestJson<BridgeLoginResponse>("POST", buildBridgeApiPath("/auth/login"));
  }

  async completeLogin(redirectUrl: string): Promise<AuthStateSnapshot> {
    return this.requestJson<AuthStateSnapshot, BridgeCompleteLoginRequest>("POST", buildBridgeApiPath("/auth/complete"), {
      redirectUrl
    });
  }

  async logout(): Promise<void> {
    await this.requestJson<BridgeLogoutResponse>("POST", buildBridgeApiPath("/auth/logout"));
  }

  async getCodexCapabilities(): Promise<BridgeCodexCapabilitiesResponse> {
    return this.requestJson<BridgeCodexCapabilitiesResponse>("GET", buildBridgeApiPath("/providers/codex/options"));
  }

  async chat(request: BridgeChatRequest): Promise<BridgeChatResponse> {
    return this.requestJson<BridgeChatResponse, BridgeChatRequest>("POST", buildBridgeApiPath("/chat"), request);
  }

  async streamChat(
    request: BridgeChatRequest,
    options?: BridgeStreamOptions
  ): Promise<BridgeChatResponse> {
    const response = await this.#fetchImpl(`${this.#baseUrl}${buildBridgeApiPath("/chat/stream")}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: options?.signal
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    let requestId: string | undefined;
    let provider = request.provider ?? "codex";
    let outputText = "";
    let streamError: string | undefined;

    await consumeServerSentEvents({
      response,
      onEvent: async (envelope) => {
        const event = parseStreamEvent(envelope);
        requestId ??= event.requestId;
        provider = event.provider;

        if (event.kind === "delta") {
          outputText += event.delta;
        }

        if (event.kind === "error") {
          streamError = event.message;
        }

        await options?.onEvent?.(event);
      }
    });

    if (streamError) {
      throw new Error(streamError);
    }

    if (!requestId) {
      throw new Error("Bridge stream finished without a request id.");
    }

    return {
      requestId,
      provider,
      model: request.model?.trim() || DEFAULT_BRIDGE_MODEL,
      outputText
    };
  }

  private async requestJson<TResponse, TBody = never>(
    method: "GET" | "POST",
    path: string,
    body?: TBody
  ): Promise<TResponse> {
    const response = await this.#fetchImpl(`${this.#baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    return (await response.json()) as TResponse;
  }
}

export function createBridgeClient(options?: BridgeClientOptions): CodexBridgeClient {
  return new CodexBridgeClient(options);
}

export function createChatClient(options?: BridgeClientOptions): CodexBridgeClient {
  return new CodexBridgeClient(options);
}
