import type { AuthStateSnapshot, ProviderId, StartLoginResult } from "./auth.js";
import type { ChatMessage } from "./network.js";

export const BRIDGE_SERVICE_NAME = "codex-bridge";
export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 47831;
export const DEFAULT_BRIDGE_MODEL = "gpt-5.4";

export type BridgeHealthResponse = {
  ok: true;
  service: typeof BRIDGE_SERVICE_NAME;
};

export type BridgeErrorResponse = {
  error: string;
};

export type BridgeLoginResponse = StartLoginResult & {
  instructions: string[];
};

export type BridgeStateResponse = AuthStateSnapshot;

export type BridgeLogoutResponse = {
  ok: true;
};

export type BridgeCompleteLoginRequest = {
  redirectUrl: string;
};

export type BridgeChatRequest = {
  provider?: ProviderId;
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  metadata?: Record<string, string>;
};

export type BridgeChatResponse = {
  requestId: string;
  provider: ProviderId;
  model: string;
  outputText: string;
};
