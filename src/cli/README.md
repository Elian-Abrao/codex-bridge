# CLI

This folder contains the transitional Node terminal entrypoints for using the bridge.

The preferred operational path is now the Python broker CLI. These commands remain useful for compatibility and comparison during migration.

## Responsibility

- start the local HTTP server
- open an interactive terminal chat
- reuse the same auth and network infrastructure as the main runtime

## Files

- [`serve.ts`](./serve.ts): starts the local bridge on loopback.
- [`chat-codex.ts`](./chat-codex.ts): starts an interactive terminal chat with login, history, and streaming support.

## Commands

```bash
npm run serve:legacy
npm run chat:legacy
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
