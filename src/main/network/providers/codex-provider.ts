import type { StreamEvent, StreamRequest } from "../../../shared/network.js";
import { CODEX_ORIGINATOR } from "../../auth/provider-definitions.js";
import type {
  PreparedRequest,
  ProviderAdapter,
  ProviderAdapterContext,
  ProviderStreamContext
} from "../provider-registry.js";

function toJsonRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function collectSystemMessages(messages: StreamRequest["messages"]): string | undefined {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);

  return system.length > 0 ? system.join("\n\n") : undefined;
}

function buildResponsesInput(messages: StreamRequest["messages"]): Array<Record<string, unknown>> {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: [
        {
          type: message.role === "assistant" ? "output_text" : "input_text",
          text: message.content
        }
      ]
    }));
}

function normalizeCodexBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (
    (trimmed.startsWith("https://chatgpt.com") || trimmed.startsWith("https://chat.openai.com")) &&
    !trimmed.includes("/backend-api/codex")
  ) {
    return `${trimmed}/backend-api/codex`;
  }
  return trimmed;
}

function parseCodexEvent(context: ProviderStreamContext): StreamEvent[] {
  if (context.envelope.data === "[DONE]") {
    return [
      {
        requestId: context.requestId,
        provider: "codex",
        kind: "done"
      }
    ];
  }

  const payload = toJsonRecord(JSON.parse(context.envelope.data) as unknown);
  if (!payload) {
    return [];
  }

  const type = typeof payload.type === "string" ? payload.type : "";
  if (type === "response.output_text.delta" && typeof payload.delta === "string") {
    return [
      {
        requestId: context.requestId,
        provider: "codex",
        kind: "delta",
        delta: payload.delta
      }
    ];
  }

  if (type === "response.failed") {
    const error = toJsonRecord(payload.error);
    return [
      {
        requestId: context.requestId,
        provider: "codex",
        kind: "error",
        message:
          (typeof error?.message === "string" && error.message) ||
          "Codex returned a failed response event."
      }
    ];
  }

  if (type === "response.completed") {
    return [
      {
        requestId: context.requestId,
        provider: "codex",
        kind: "done"
      }
    ];
  }

  return [];
}

export class CodexProviderAdapter implements ProviderAdapter {
  readonly id = "codex" as const;

  async prepareRequest(context: ProviderAdapterContext): Promise<PreparedRequest> {
    const session = await context.authService.getValidSession();
    const baseUrl = normalizeCodexBaseUrl(
      context.config.codex?.baseUrl ?? "https://chatgpt.com/backend-api/codex"
    );

    const headers: Record<string, string> = {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      originator: context.config.codex?.originator ?? CODEX_ORIGINATOR,
      "User-Agent": context.config.codex?.userAgent ?? "codex-bridge/electron"
    };

    if (session.accountId) {
      headers["ChatGPT-Account-Id"] = session.accountId;
    }

    return {
      url: `${baseUrl}/responses`,
      method: "POST",
      headers,
      body: JSON.stringify({
        model: context.request.model,
        stream: true,
        instructions: collectSystemMessages(context.request.messages),
        input: buildResponsesInput(context.request.messages)
      })
    };
  }

  mapSseEvent(context: ProviderStreamContext): StreamEvent[] {
    return parseCodexEvent(context);
  }
}
