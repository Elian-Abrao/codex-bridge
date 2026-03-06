# Client

This folder contains the `codex-bridge` consumption SDK.

## Responsibility

The client wraps HTTP calls to the local bridge and exposes a small API for:

- checking service health
- reading authentication state
- starting and completing login
- sending synchronous chat requests
- consuming streaming chat responses

## Files

- [`index.ts`](./index.ts): implements `CodexBridgeClient`, `createBridgeClient()`, and `createChatClient()`.

## Flow

1. Your project instantiates the client with the bridge URL.
2. The client calls the local auth and chat endpoints.
3. The bridge handles session state, refresh, and provider transport.

## Example

```ts
import { createChatClient } from "codex-bridge";

const client = createChatClient({
  baseUrl: "http://127.0.0.1:47831"
});

const response = await client.chat({
  messages: [{ role: "user", content: "Explain this class." }]
});
```

## See Also

- [root README](../../README.md)
- [server](../server/README.md)
- [shared](../shared/README.md)
