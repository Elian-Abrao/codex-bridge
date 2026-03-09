# Target Architecture

This document defines the intended product shape for the next major iteration of `codex-bridge`.

It does not describe every detail of the current repository. It defines the target we will refactor toward.

## Product Definition

`codex-bridge` will become a **local Codex broker**.

Its job is to:

- authenticate the user with the Codex-compatible OAuth flow
- persist and refresh the session locally
- expose a stable local HTTP API
- provide a CLI for operating the broker
- let other applications consume Codex without reimplementing auth, session management, or transport details

## Core Decisions

### 1. Python-first runtime

The primary runtime will be Python.

Why:

- the project is moving away from being Electron-centered
- the main use case is now a reusable local broker for multiple projects
- Python fits well as an application runtime, CLI host, and broker implementation
- keeping Node as the core while also supporting Python makes the product identity weaker

### 2. Codex-only scope

The product will focus on Codex only for the first stable release.

Why:

- it reduces API surface and maintenance cost
- it aligns the product with the actual user goal
- it removes confusion created by generic multi-provider messaging

Implication:

- OpenAI and Gemini integrations are not part of the target public product
- if they remain temporarily in the repository, they are considered transitional code

### 3. Broker is the product

The broker is the main deliverable.

The CLI exists to operate the broker.

The SDKs exist to consume the broker.

This separation matters:

- broker: owns auth, session, transport, compatibility
- CLI: gives a human operator commands to run, log in, inspect, and test
- SDKs: give applications a typed way to call the broker

### 4. Local-first deployment

The standard operating mode is:

- broker runs on the same machine as the user
- browser-based login redirects back to a local loopback callback

Remote-server use remains possible, but it is not the primary mode. If supported, it should be treated as an advanced/manual flow.

## Non-goals

These are not goals for the next stable version:

- being a general-purpose multi-provider gateway
- being Electron-first
- making the interactive CLI the main product
- making the SDKs operate without the broker
- supporting distributed or multi-tenant remote service operation as the default mode

## Deliverables

### 1. Broker

The broker is a local HTTP service with:

- OAuth PKCE login
- local session persistence
- automatic token refresh
- Codex model and reasoning metadata
- synchronous and streaming chat endpoints

### 2. CLI

The CLI is the operational interface for developers and power users.

Expected commands:

- `codex-bridge serve`
- `codex-bridge login`
- `codex-bridge logout`
- `codex-bridge status`
- `codex-bridge models`
- `codex-bridge chat`

The CLI is also the easiest smoke-test tool for the broker.

### 3. SDKs

SDKs are thin clients over the broker HTTP API.

Planned support:

- Python SDK as first-class
- JavaScript/TypeScript SDK as optional secondary client

SDK responsibilities:

- simplify auth calls
- simplify chat calls
- handle SSE streaming ergonomically
- stay thin and avoid duplicating broker logic

## Minimal Public HTTP API

The target public API should be versioned under `/v1`.

### Health

- `GET /v1/health`

Response shape:

```json
{
  "ok": true,
  "service": "codex-bridge"
}
```

### Auth

- `GET /v1/auth/state`
- `POST /v1/auth/login`
- `POST /v1/auth/complete`
- `POST /v1/auth/logout`

`POST /v1/auth/login` returns:

- provider identifier
- authorization URL
- redirect URI
- expiration timestamp
- manual fallback instructions

`POST /v1/auth/complete` accepts:

```json
{
  "redirectUrl": "http://localhost:1455/auth/callback?code=...&state=..."
}
```

### Capabilities

- `GET /v1/providers/codex/options`

This returns:

- authenticated status
- authenticated account email when available
- billing mode
- default model
- default reasoning effort
- available models
- available reasoning efforts

### Chat

- `POST /v1/chat`
- `POST /v1/chat/stream`

Request shape:

```json
{
  "model": "gpt-5.4",
  "reasoningEffort": "medium",
  "messages": [
    { "role": "user", "content": "Explain this file." }
  ]
}
```

Rules:

- `provider` is omitted from the public API because the product is Codex-only
- unsupported model or reasoning aliases should be normalized by the broker when safe
- streaming uses Server-Sent Events

## Target Repository Layout

The repository should move toward this structure:

```text
broker/
  src/
    codex_bridge/
      api/
      auth/
      cli/
      runtime/
      storage/
      transport/
  tests/
  pyproject.toml

sdk/
  js/
    src/
    package.json

examples/
  fastapi/

docs/
  TARGET_ARCHITECTURE.md
  MIGRATION_PLAN.md
```

Notes:

- the Python broker becomes the center of gravity
- the JavaScript SDK becomes a secondary client package
- Electron-specific integration should move out of the main product path

## Quality Bar For A Professional v1

We should treat the product as professionally deliverable only when it has:

- a Python broker runtime as the canonical implementation
- a versioned public API
- automated tests for auth flow boundaries, API behavior, and streaming behavior
- documented CLI workflows
- documented SDK usage
- secure session storage strategy
- release and CI workflows

## Secure Storage Direction

The current JSON-file session approach is acceptable for alpha/local experimentation.

The target direction is:

- OS keychain or secret store when available
- explicit file-based fallback for unsupported environments
- documented storage behavior

## Compatibility Position

`codex-bridge` depends on the behavior of the Codex-compatible backend and OAuth flow.

That means the broker must take ownership of:

- request normalization
- compatibility shims for supported models and reasoning effort values
- clear operational errors when backend assumptions change

This responsibility belongs in the broker, not in clients.
