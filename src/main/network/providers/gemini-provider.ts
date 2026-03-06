import type { StreamEvent } from "../../../shared/network.js";
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

function applySystemMessages(messages: ProviderAdapterContext["request"]["messages"]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean);
  const nonSystem = messages.filter((message) => message.role !== "system");

  if (system.length === 0) {
    return nonSystem;
  }

  const prelude = system.join("\n\n");
  if (nonSystem.length === 0) {
    return [{ role: "user" as const, content: prelude }];
  }

  const first = nonSystem[0];
  if (!first) {
    return [{ role: "user" as const, content: prelude }];
  }

  return [{ ...first, content: `${prelude}\n\n${first.content}` }, ...nonSystem.slice(1)];
}

function parseGeminiEvent(context: ProviderStreamContext): StreamEvent[] {
  if (context.envelope.data === "[DONE]") {
    return [
      {
        requestId: context.requestId,
        provider: "gemini",
        kind: "done"
      }
    ];
  }

  const payload = toJsonRecord(JSON.parse(context.envelope.data) as unknown);
  if (!payload) {
    return [];
  }

  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const deltas: string[] = [];

  for (const candidate of candidates) {
    const candidateRecord = toJsonRecord(candidate);
    const content = toJsonRecord(candidateRecord?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];

    for (const part of parts) {
      const partRecord = toJsonRecord(part);
      if (typeof partRecord?.text === "string" && partRecord.text.length > 0) {
        deltas.push(partRecord.text);
      }
    }
  }

  return deltas.map((delta) => ({
    requestId: context.requestId,
    provider: "gemini",
    kind: "delta" as const,
    delta
  }));
}

export class GeminiProviderAdapter implements ProviderAdapter {
  readonly id = "gemini" as const;

  async prepareRequest(context: ProviderAdapterContext): Promise<PreparedRequest> {
    const apiKey = readRequiredApiKey("gemini", context.config.gemini?.apiKey ?? process.env.GEMINI_API_KEY);
    const baseUrl = (context.config.gemini?.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "");
    const messages = applySystemMessages(context.request.messages);

    return {
      url: `${baseUrl}/models/${encodeURIComponent(context.request.model)}:streamGenerateContent?alt=sse`,
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }]
        })),
        generationConfig:
          typeof context.request.temperature === "number"
            ? { temperature: context.request.temperature }
            : undefined
      })
    };
  }

  mapSseEvent(context: ProviderStreamContext): StreamEvent[] {
    return parseGeminiEvent(context);
  }
}
