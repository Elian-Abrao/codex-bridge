import { randomUUID } from "node:crypto";
import type { WebContents } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc.js";
import type { StreamEvent, StreamRequest } from "../../shared/network.js";
import type { AuthService } from "../auth/auth-service.js";
import { consumeServerSentEvents } from "./streaming.js";
import type { ProviderAdapter, ProviderRuntimeConfig } from "./provider-registry.js";

export type NetworkFacadeOptions = {
  authService: AuthService;
  config?: ProviderRuntimeConfig;
  fetchImpl?: typeof fetch;
  adapters: ProviderAdapter[];
};

export class ProviderFacade {
  readonly #authService: AuthService;
  readonly #fetchImpl: typeof fetch;
  readonly #adapterById: Map<string, ProviderAdapter>;
  readonly #inflight = new Map<string, AbortController>();
  #config: ProviderRuntimeConfig;

  constructor(options: NetworkFacadeOptions) {
    this.#authService = options.authService;
    this.#fetchImpl = options.fetchImpl ?? fetch;
    this.#config = options.config ?? {};
    this.#adapterById = new Map(options.adapters.map((adapter) => [adapter.id, adapter]));
  }

  updateConfig(config: ProviderRuntimeConfig): void {
    this.#config = config;
  }

  async startStream(target: WebContents, request: StreamRequest): Promise<{ requestId: string }> {
    const requestId = request.requestId ?? randomUUID();
    const abortController = new AbortController();
    this.#inflight.set(requestId, abortController);

    void this.streamWithEvents({
      requestId,
      request,
      abortController,
      onEvent: (event) => this.send(target, event)
    }).finally(() => {
      this.#inflight.delete(requestId);
    });

    return { requestId };
  }

  async stream(params: {
    request: StreamRequest;
    onEvent: (event: StreamEvent) => Promise<void> | void;
  }): Promise<{ requestId: string; abort: () => void; completed: Promise<void> }> {
    const requestId = params.request.requestId ?? randomUUID();
    const abortController = new AbortController();
    this.#inflight.set(requestId, abortController);

    const completed = this.streamWithEvents({
      requestId,
      request: params.request,
      abortController,
      onEvent: params.onEvent
    }).finally(() => {
      this.#inflight.delete(requestId);
    });

    return {
      requestId,
      abort: () => abortController.abort(),
      completed
    };
  }

  async abortStream(requestId: string): Promise<void> {
    this.#inflight.get(requestId)?.abort();
  }

  private async streamWithEvents(params: {
    requestId: string;
    request: StreamRequest;
    abortController: AbortController;
    onEvent: (event: StreamEvent) => Promise<void> | void;
  }
  ): Promise<void> {
    const { requestId, request, abortController, onEvent } = params;
    const adapter = this.#adapterById.get(request.provider);
    if (!adapter) {
      await onEvent({
        requestId,
        provider: request.provider,
        kind: "error",
        message: `Unsupported provider: ${request.provider}`
      });
      return;
    }

    try {
      await onEvent({
        requestId,
        provider: request.provider,
        kind: "status",
        message: `Connecting to ${request.provider}...`
      });

      const prepared = await adapter.prepareRequest({
        request,
        authService: this.#authService,
        config: this.#config
      });

      const response = await this.#fetchImpl(prepared.url, {
        method: prepared.method,
        headers: prepared.headers,
        body: prepared.body,
        signal: abortController.signal
      });

      if (!response.ok) {
        const text = await response.text();
        await onEvent({
          requestId,
          provider: request.provider,
          kind: "error",
          message: `Request failed (${response.status}): ${text}`
        });
        return;
      }

      await consumeServerSentEvents({
        response,
        onEvent: async (envelope) => {
          for (const event of adapter.mapSseEvent({ requestId, request, envelope })) {
            await onEvent(event);
          }
        }
      });

      await onEvent({
        requestId,
        provider: request.provider,
        kind: "done"
      });
    } catch (error) {
      if (abortController.signal.aborted) {
        await onEvent({
          requestId,
          provider: request.provider,
          kind: "done"
        });
        return;
      }

      await onEvent({
        requestId,
        provider: request.provider,
        kind: "error",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private send(target: WebContents, event: StreamEvent): void {
    if (target.isDestroyed()) {
      return;
    }
    target.send(IPC_CHANNELS.aiStreamEvent, event);
  }
}
