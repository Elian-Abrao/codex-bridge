# codex-bridge

Local bridge for Codex authentication and chat access.

## Status

The repository is in transition.

- Current implementation: a local broker/runtime in Node.js with optional Electron integration, a Node SDK, and a Python SDK.
- Migration work now started: a Python broker skeleton lives in [`broker/`](./broker/README.md).
- Target direction: a Python-first, Codex-only local broker with a small CLI and SDKs that consume the broker over HTTP.

The design decisions for that repositioning live in:

- [Target Architecture](./docs/TARGET_ARCHITECTURE.md)
- [Migration Plan](./docs/MIGRATION_PLAN.md)

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

These are the current usage modes implemented in the repository today.

### 1. Local Bridge

The project starts an HTTP server on loopback and other applications consume its endpoints.

### 2. Client SDKs

A Node or Python project consumes the local bridge through a small SDK.

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
curl http://127.0.0.1:47831/v1/health
```

Start Codex login:

```bash
curl -X POST http://127.0.0.1:47831/v1/auth/login
```

The `provider` field is optional in the current Node implementation, but the target public contract is Codex-only. New consumers should treat Codex as implicit.

Provider capabilities:

```bash
curl http://127.0.0.1:47831/v1/providers/codex/options
```

This endpoint returns:

- authentication status for the current Codex session
- the advertised model list for `codex`
- supported reasoning effort values
- the default model and default reasoning effort

Synchronous chat:

```bash
curl -X POST http://127.0.0.1:47831/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.4",
    "reasoningEffort": "medium",
    "messages": [
      { "role": "user", "content": "Reply with a short sentence." }
    ]
  }'
```

Streaming:

```bash
curl -N -X POST http://127.0.0.1:47831/v1/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.4",
    "reasoningEffort": "high",
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

Via the Node SDK:

```ts
import { createChatClient } from "codex-bridge";

const client = createChatClient({
  baseUrl: "http://127.0.0.1:47831"
});

const reply = await client.chat({
  model: "gpt-5.4",
  reasoningEffort: "medium",
  messages: [{ role: "user", content: "Explain this file." }]
});

console.log(reply.outputText);
```

Via the Python SDK:

```bash
pip install ./python
```

```python
from codex_bridge import create_chat_client

client = create_chat_client("http://127.0.0.1:47831")

reply = client.chat(
    {
        "model": "gpt-5.4",
        "reasoningEffort": "medium",
        "messages": [{"role": "user", "content": "Explain this file."}],
    }
)

print(reply["outputText"])
```

FastAPI example:

```bash
pip install -e './python[examples]'
uvicorn fastapi_app:app --app-dir python/examples --reload
```

Via HTTP:

```bash
curl -X POST http://127.0.0.1:47831/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "reasoningEffort": "medium",
    "messages": [
      { "role": "user", "content": "Summarize this file." }
    ]
  }'
```

## Documentation By Folder

- [docs](./docs/TARGET_ARCHITECTURE.md)
- [broker](./broker/README.md)
- [src/client](./src/client/README.md)
- [src/cli](./src/cli/README.md)
- [src/main](./src/main/README.md)
- [src/main/auth](./src/main/auth/README.md)
- [src/main/ipc](./src/main/ipc/README.md)
- [src/main/network](./src/main/network/README.md)
- [src/main/network/providers](./src/main/network/providers/README.md)
- [python](./python/README.md)
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
python/
  src/codex_bridge/  Python SDK for consuming the local bridge
  examples/          FastAPI integration example
  tests/             Python SDK test suite
broker/
  src/codex_bridge_broker/  Python-first broker skeleton
  tests/                    Python broker tests
docs/
  TARGET_ARCHITECTURE.md  Python-first product direction
  MIGRATION_PLAN.md       refactor and removal plan
```
