import type { ProviderId } from "./auth.js";

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type StreamRequest = {
  requestId?: string;
  provider: ProviderId;
  model: string;
  messages: ChatMessage[];
  reasoningEffort?: string;
  temperature?: number;
  metadata?: Record<string, string>;
};

export type StreamEvent =
  | {
      requestId: string;
      provider: ProviderId;
      kind: "status";
      message: string;
    }
  | {
      requestId: string;
      provider: ProviderId;
      kind: "delta";
      delta: string;
    }
  | {
      requestId: string;
      provider: ProviderId;
      kind: "done";
    }
  | {
      requestId: string;
      provider: ProviderId;
      kind: "error";
      message: string;
    };
