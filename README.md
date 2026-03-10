# codex-bridge

Local Python broker for Codex authentication and chat access.

## What It Is

`codex-bridge` is a local broker that centralizes:

- OAuth PKCE login against the Codex-compatible auth flow
- local session persistence and automatic token refresh
- Codex model and reasoning metadata
- synchronous and streaming chat endpoints
- a CLI for operating the broker locally

Applications integrate with the broker over HTTP instead of reimplementing OAuth, callback handling, refresh, and Codex-specific request details.

## Repository Layout

```text
src/codex_bridge/     broker runtime, auth, CLI, HTTP server
tests/                broker test suite
sdk/                  separate Python SDK package and examples
docs/                 architecture and publishing guides
```

## Install

Install the broker locally:

```bash
pip install -e .
```

Install with secure OS keyring support:

```bash
pip install -e '.[secure]'
```

## CLI

Start the login flow:

```bash
codex-bridge login
```

Start the local broker:

```bash
codex-bridge serve
```

Inspect current state:

```bash
codex-bridge status
codex-bridge models
```

Send a quick chat request:

```bash
codex-bridge chat "Explain this repository."
```

## HTTP API

The public API is versioned under `/v1`.

- `GET /v1/health`
- `GET /v1/auth/state`
- `POST /v1/auth/login`
- `POST /v1/auth/complete`
- `POST /v1/auth/logout`
- `GET /v1/providers/codex/options`
- `POST /v1/chat`
- `POST /v1/chat/stream`

Example:

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

## Development

Run the broker test suite:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```

Run the broker directly from source:

```bash
PYTHONPATH=src python -m codex_bridge serve
```

## SDK

The repository also contains a separate Python SDK package in [`sdk/`](./sdk/README.md).

Published package target:

```bash
pip install codex-bridge-sdk
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Publishing](./docs/PUBLISHING.md)
- [SDK](./sdk/README.md)
