import type { AuthStateSnapshot, ProviderId, StartLoginResult } from "./auth.js";
import type { ChatMessage } from "./network.js";

export const BRIDGE_SERVICE_NAME = "codex-bridge";
export const DEFAULT_BRIDGE_HOST = "127.0.0.1";
export const DEFAULT_BRIDGE_PORT = 47831;
export const DEFAULT_BRIDGE_MODEL = "gpt-5.4";
export const DEFAULT_BRIDGE_REASONING_EFFORT = "medium";
export const BLOCKED_CODEX_CHATGPT_MODELS = new Set(["gpt-5-nano"]);
export const SUPPORTED_CODEX_REASONING_EFFORTS = ["none", "low", "medium", "high", "xhigh"] as const;
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
  }
];
export const DEFAULT_CODEX_REASONING_EFFORTS: BridgeOption[] = [
  {
    id: "none",
    label: "None",
    description: "Fastest profile with reasoning effectively disabled."
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
  },
  {
    id: "xhigh",
    label: "XHigh",
    description: "Maximum reasoning depth for the hardest prompts."
  }
];

export type BridgeReasoningEffort = typeof SUPPORTED_CODEX_REASONING_EFFORTS[number];

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

export function normalizeCodexBridgeModel(model: string | undefined | null): string {
  const normalized = String(model || "").trim();
  if (!normalized || BLOCKED_CODEX_CHATGPT_MODELS.has(normalized)) {
    return DEFAULT_BRIDGE_MODEL;
  }
  return normalized;
}

export function normalizeCodexReasoningEffort(effort: string | undefined | null): BridgeReasoningEffort {
  const normalized = String(effort || "").trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_BRIDGE_REASONING_EFFORT;
  }
  if (normalized === "minimal") {
    return "low";
  }
  if ((SUPPORTED_CODEX_REASONING_EFFORTS as readonly string[]).includes(normalized)) {
    return normalized as BridgeReasoningEffort;
  }
  return DEFAULT_BRIDGE_REASONING_EFFORT;
}
