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

## Layers

## 1. CLI

Entry point:

- `codex-bridge`

Responsibilities:

- start the broker
- start login
- show state and available models
- run a quick chat request

Implementation:

- `src/codex_bridge/cli.py`

## 2. Runtime

Responsibilities:

- assemble auth and Codex services
- load configuration
- wire storage and transport together

Implementation:

- `src/codex_bridge/runtime.py`

## 3. Auth

Responsibilities:

- PKCE generation
- OAuth authorization URL
- local callback server
- manual callback fallback
- token exchange
- refresh flow
- session lifecycle

Implementation:

- `src/codex_bridge/auth.py`
- `src/codex_bridge/pkce.py`
- `src/codex_bridge/oauth.py`
- `src/codex_bridge/callback.py`
- `src/codex_bridge/session_store.py`
- `src/codex_bridge/jwt.py`

## 4. Codex Transport

Responsibilities:

- normalize model and reasoning values
- build Codex request payloads
- map SSE events into broker events
- expose sync and streaming chat

Implementation:

- `src/codex_bridge/codex.py`
- `src/codex_bridge/default_instructions.py`

## 5. HTTP API

Responsibilities:

- expose the broker contract under `/v1`
- serialize broker errors consistently
- expose sync and streaming endpoints

Implementation:

- `src/codex_bridge/api.py`
- `src/codex_bridge/server.py`

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
