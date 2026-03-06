# CLI

This folder contains the terminal entrypoints for using the bridge.

## Responsibility

- start the local HTTP server
- open an interactive terminal chat
- reuse the same auth and network infrastructure as the main runtime

## Files

- [`serve.ts`](./serve.ts): starts the local bridge on loopback.
- [`chat-codex.ts`](./chat-codex.ts): starts an interactive terminal chat with login, history, and streaming support.

## Commands

```bash
npm run serve
npm run chat:codex
```

## Environment Variables

- `CODEX_BRIDGE_PORT`
- `CODEX_BRIDGE_MODEL`
- `CODEX_BRIDGE_URL`
- `CODEX_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_BASE_URL`

## See Also

- [root README](../../README.md)
- [server](../server/README.md)
- [client](../client/README.md)
