# codex-bridge

Local bridge for Codex authentication and chat access.

## Status

The preferred product path is now the Python broker in [`broker/`](./broker/README.md).

- Canonical runtime: Python broker, Codex-only.
- Canonical API: versioned HTTP routes under `/v1`.
- Canonical operation path: local broker + CLI + SDKs.
- Transitional compatibility path: Node runtime and Electron integration under `src/`.

The design decisions for that repositioning live in:

- [Target Architecture](./docs/TARGET_ARCHITECTURE.md)
- [Migration Plan](./docs/MIGRATION_PLAN.md)

## What It Is

`codex-bridge` is a local Codex broker.

It centralizes:

- OAuth PKCE login
- session persistence and refresh
- Codex model metadata
- synchronous and streaming chat transport
- a local HTTP API for other applications
- a CLI for local operation and smoke testing

## Principles

- PKCE with `code_verifier` and `code_challenge` in `S256`.
- Loopback callback on `127.0.0.1:1455/auth/callback`.
- A random `state` value distinct from the verifier, validated strictly for CSRF protection.
- A 5-minute timeout for the local callback server with automatic shutdown.
- Manual fallback by pasting the final redirect URL.
- Session and refresh management centralized in the broker.
- Codex-only public API, without multi-provider branching in consumers.

## Usage Modes

### 1. Python Broker

Run the canonical local broker:

```bash
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli login
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli serve
```

Health check:

```bash
curl http://127.0.0.1:47831/v1/health
```

Start Codex login:

```bash
curl -X POST http://127.0.0.1:47831/v1/auth/login
```

The public broker contract is Codex-only. Consumers should not branch by provider.

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
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli chat "Explain this repository."
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

## Transitional Node Runtime

The Node runtime still exists as a compatibility implementation:

```bash
npm install
npm run build
npm run serve
```

It accepts the same `/v1` API and also keeps the legacy unversioned aliases during migration.

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
  client/    transitional Node SDK
  cli/       transitional Node CLI entrypoints
  main/      transitional Electron runtime
  preload/   transitional Electron preload bridge
  server/    transitional Node HTTP bridge
  shared/    shared TypeScript contracts
python/
  src/codex_bridge/  Python SDK for consuming the local bridge
  examples/          FastAPI integration example
  tests/             Python SDK test suite
broker/
  src/codex_bridge_broker/  Python-first broker runtime
  tests/                    Python broker tests
docs/
  TARGET_ARCHITECTURE.md  Python-first product direction
  MIGRATION_PLAN.md       refactor and removal plan
```
