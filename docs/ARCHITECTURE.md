# Architecture

## Product Shape

`codex-bridge` is a local Python broker for Codex.

It owns:

- OAuth PKCE login
- loopback callback handling
- session persistence and refresh
- Codex request normalization
- HTTP API exposure
- operator-facing CLI commands

It does not try to be a generic multi-provider gateway.

## Layered Design

### 1. `domain/`

Purpose:

- define broker entities and policies
- expose ports for adapters
- keep pure rules independent from network, disk, or CLI

Key modules:

- `src/codex_bridge/domain/auth.py`
- `src/codex_bridge/domain/callbacks.py`
- `src/codex_bridge/domain/codex.py`
- `src/codex_bridge/domain/errors.py`
- `src/codex_bridge/domain/ports.py`

### 2. `app/`

Purpose:

- orchestrate use cases
- coordinate ports and domain policies
- keep workflow logic separate from concrete adapters

Key modules:

- `src/codex_bridge/app/auth_service.py`
- `src/codex_bridge/app/chat_service.py`

### 3. `infra/`

Purpose:

- implement the ports defined by `domain`
- talk to OAuth, Codex HTTP endpoints, local callback server, filesystem, and keyring

Key modules:

- `src/codex_bridge/infra/auth/callback_server.py`
- `src/codex_bridge/infra/auth/oauth_gateway.py`
- `src/codex_bridge/infra/auth/jwt_claims.py`
- `src/codex_bridge/infra/auth/pkce.py`
- `src/codex_bridge/infra/codex/http_gateway.py`
- `src/codex_bridge/infra/storage/session_store.py`

### 4. `interfaces/`

Purpose:

- expose the public surfaces of the product
- keep CLI and HTTP concerns out of the application layer

Key modules:

- `src/codex_bridge/interfaces/cli.py`
- `src/codex_bridge/interfaces/http/api.py`
- `src/codex_bridge/interfaces/http/server.py`

### 5. `bootstrap/`

Purpose:

- resolve configuration
- compose adapters and services
- construct the runtime used by CLI and HTTP

Key modules:

- `src/codex_bridge/bootstrap/config.py`
- `src/codex_bridge/bootstrap/runtime.py`

## API Contract

- `GET /v1/health`
- `GET /v1/auth/state`
- `POST /v1/auth/login`
- `POST /v1/auth/complete`
- `POST /v1/auth/logout`
- `GET /v1/providers/codex/options`
- `POST /v1/chat`
- `POST /v1/chat/stream`

## Storage Strategy

Primary:

- OS keyring when `keyring` is installed

Fallback:

- local JSON metadata/session file

This keeps the broker usable in minimal environments while still supporting stronger storage on developer machines.

## SDK Boundary

The SDK lives in `sdk/` and consumes the broker over HTTP.

It does not duplicate:

- OAuth logic
- refresh logic
- callback handling
- Codex transport logic

## Test Layout

- `tests/unit`
  - fast tests for application services and storage logic
- `tests/integration`
  - HTTP API and runtime wiring tests
- `tests/e2e`
  - subprocess-level CLI smoke tests
