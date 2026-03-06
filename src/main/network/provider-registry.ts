import type { StreamRequest, StreamEvent } from "../../shared/network.js";
import type { ProviderId } from "../../shared/auth.js";
import type { AuthService } from "../auth/auth-service.js";

export type SseEnvelope = {
  event?: string;
  data: string;
};

export type PreparedRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

export type ProviderRuntimeConfig = {
  openai?: {
    apiKey?: string;
    baseUrl?: string;
  };
  gemini?: {
    apiKey?: string;
    baseUrl?: string;
  };
  codex?: {
    baseUrl?: string;
    originator?: string;
    userAgent?: string;
  };
};

export type ProviderAdapterContext = {
  request: StreamRequest;
  authService: AuthService;
  config: ProviderRuntimeConfig;
};

export type ProviderStreamContext = {
  requestId: string;
  request: StreamRequest;
  envelope: SseEnvelope;
};

export interface ProviderAdapter {
  readonly id: ProviderId;
  prepareRequest(context: ProviderAdapterContext): Promise<PreparedRequest>;
  mapSseEvent(context: ProviderStreamContext): StreamEvent[];
}

export function readRequiredApiKey(
  provider: ProviderId,
  apiKey: string | undefined
): string {
  if (!apiKey?.trim()) {
    throw new Error(`Missing API key for ${provider}.`);
  }

  return apiKey.trim();
}
