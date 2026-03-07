import type { AuthStateSnapshot, ProviderId, StartLoginResult } from "./auth.js";
import type { ChatMessage } from "./network.js";

export const BRIDGE_SERVICE_NAME = "codex-bridge";
export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 47831;
export const DEFAULT_BRIDGE_MODEL = "gpt-5.4";
export const DEFAULT_BRIDGE_REASONING_EFFORT = "medium";
export const DEFAULT_CODEX_MODELS: BridgeOption[] = [
  {
    id: "gpt-5.4",
    label: "gpt-5.4",
    description: "Balanced default for Codex-backed chat workflows.",
    recommended: true
  },
  {
    id: "gpt-5",
    label: "gpt-5",
    description: "General-purpose GPT-5 model for broader compatibility."
  },
  {
    id: "gpt-5-mini",
    label: "gpt-5-mini",
    description: "Lower-latency GPT-5 option for lighter tasks."
  },
  {
    id: "gpt-5-nano",
    label: "gpt-5-nano",
    description: "Smallest GPT-5 option for quick iterations."
  }
];
export const DEFAULT_CODEX_REASONING_EFFORTS: BridgeOption[] = [
  {
    id: "minimal",
    label: "Minimal",
    description: "Fastest reasoning profile with minimal deliberation."
  },
  {
    id: "low",
    label: "Low",
    description: "Light reasoning for straightforward tasks."
  },
  {
    id: "medium",
    label: "Medium",
    description: "Balanced reasoning depth for most requests.",
    recommended: true
  },
  {
    id: "high",
    label: "High",
    description: "More deliberate reasoning for harder prompts."
  }
];

export type BridgeReasoningEffort = "minimal" | "low" | "medium" | "high";

export type BridgeOption = {
  id: string;
  label: string;
  description?: string;
  recommended?: boolean;
};

export type BridgeCodexCapabilitiesResponse = {
  provider: "codex";
  billingMode: "monthly";
  requiresAuth: true;
  authenticated: boolean;
  accountEmail?: string;
  defaultModel: string;
  defaultReasoningEffort: BridgeReasoningEffort;
  models: BridgeOption[];
  reasoningEfforts: BridgeOption[];
};

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
  reasoningEffort?: BridgeReasoningEffort;
  temperature?: number;
  metadata?: Record<string, string>;
};

export type BridgeChatResponse = {
  requestId: string;
  provider: ProviderId;
  model: string;
  outputText: string;
};
