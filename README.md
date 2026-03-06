# codex-bridge

Local bridge for authentication and AI chat, designed to be reused across Electron projects and Node applications.

## What It Is

`codex-bridge` splits the problem into 4 layers:

- authentication and session management
- provider transport
- a reusable local server
- optional Electron integration

Because of that, consuming projects talk to a local API or a small SDK instead of reimplementing OAuth, token refresh, and provider-specific request details.

## Principles

- PKCE with `code_verifier` and `code_challenge` in `S256`.
- Loopback callback on `127.0.0.1:1455/auth/callback`.
- A random `state` value distinct from the verifier, validated strictly for CSRF protection.
- A 5-minute timeout for the local callback server with automatic shutdown.
- Manual fallback by pasting the final redirect URL.
- Session and refresh management centralized in the runtime, without exposing tokens to the frontend.
- A provider facade so UI layers and client apps stay backend-agnostic.

## Usage Modes

### 1. Local Bridge

The project starts an HTTP server on loopback and other applications consume its endpoints.

### 2. Client SDK

A Node project consumes the local bridge through `createChatClient()`.

### 3. Electron Integration

An Electron app can embed the runtime in the `main process` and expose only the safe bridge through `preload`.

## Local Bridge Mode

Start the local server:

```bash
npm install
npm run build
npm run serve
```

Health check:

```bash
curl http://127.0.0.1:47831/health
```

Start Codex login:

```bash
curl -X POST http://127.0.0.1:47831/auth/login
```

The `provider` field is optional in `/chat` and `/chat/stream`. If omitted, it defaults to `codex`.

Synchronous chat:

```bash
curl -X POST http://127.0.0.1:47831/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Reply with a short sentence." }
    ]
  }'
```

Streaming:

```bash
curl -N -X POST http://127.0.0.1:47831/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Reply with a short sentence." }
    ]
  }'
```

Interactive CLI:

```bash
npm run chat:codex
```

## Using It From Another Project

Via the SDK:

```ts
import { createChatClient } from "codex-bridge";

const client = createChatClient({
  baseUrl: "http://127.0.0.1:47831"
});

const reply = await client.chat({
  messages: [{ role: "user", content: "Explain this file." }]
});

console.log(reply.outputText);
```

Via HTTP:

```bash
curl -X POST http://127.0.0.1:47831/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Summarize this file." }
    ]
  }'
```

## Documentation By Folder

- [src/client](./src/client/README.md)
- [src/cli](./src/cli/README.md)
- [src/main](./src/main/README.md)
- [src/main/auth](./src/main/auth/README.md)
- [src/main/ipc](./src/main/ipc/README.md)
- [src/main/network](./src/main/network/README.md)
- [src/main/network/providers](./src/main/network/providers/README.md)
- [src/preload](./src/preload/README.md)
- [src/server](./src/server/README.md)
- [src/shared](./src/shared/README.md)

## Structure

```text
src/
  client/    SDK for consuming the local bridge
  cli/       Terminal entrypoints
  main/      Electron runtime
  preload/   Safe API exposed to the renderer
  server/    Local HTTP bridge
  shared/    Shared types and contracts
```
