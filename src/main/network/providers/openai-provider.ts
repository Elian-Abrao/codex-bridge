import type { StreamEvent, StreamRequest } from "../../../shared/network.js";
import type {
  PreparedRequest,
  ProviderAdapter,
  ProviderAdapterContext,
  ProviderStreamContext
} from "../provider-registry.js";
import { readRequiredApiKey } from "../provider-registry.js";

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

function parseOpenAiEvent(context: ProviderStreamContext): StreamEvent[] {
  if (context.envelope.data === "[DONE]") {
    return [
      {
        requestId: context.requestId,
        provider: "openai",
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
        provider: "openai",
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
        provider: "openai",
        kind: "error",
        message:
          (typeof error?.message === "string" && error.message) ||
          "OpenAI returned a failed response event."
      }
    ];
  }

  if (type === "response.completed") {
    return [
      {
        requestId: context.requestId,
        provider: "openai",
        kind: "done"
      }
    ];
  }

  return [];
}

export class OpenAiProviderAdapter implements ProviderAdapter {
  readonly id = "openai" as const;

  async prepareRequest(context: ProviderAdapterContext): Promise<PreparedRequest> {
    const apiKey = readRequiredApiKey("openai", context.config.openai?.apiKey ?? process.env.OPENAI_API_KEY);
    const baseUrl = (context.config.openai?.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");

    return {
      url: `${baseUrl}/responses`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        model: context.request.model,
        stream: true,
        temperature: context.request.temperature,
        instructions: collectSystemMessages(context.request.messages),
        input: buildResponsesInput(context.request.messages)
      })
    };
  }

  mapSseEvent(context: ProviderStreamContext): StreamEvent[] {
    return parseOpenAiEvent(context);
  }
}
