# Providers

This folder contains the concrete adapters for each supported backend.

## Responsibility

Each adapter knows:

- how to build the provider request
- which headers to send
- how to convert SSE events into `StreamEvent`

## Files

- [`codex-provider.ts`](./codex-provider.ts): uses the Codex OAuth session and supports `ChatGPT-Account-Id`.
- [`openai-provider.ts`](./openai-provider.ts): uses an API key and the `/v1/responses` API.
- [`gemini-provider.ts`](./gemini-provider.ts): uses an API key and `streamGenerateContent`.

## Design Rule

When a new provider is added, the change should stay concentrated here and in facade registration, without leaking rules into the renderer or the client SDK.

## See Also

- [network](../README.md)
- [shared](../../../shared/README.md)
