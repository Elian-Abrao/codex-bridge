# Python Broker

This folder contains the Python-first broker runtime that is becoming the canonical product path.

## Status

It currently provides:

- a Python package layout for the broker
- a local HTTP server with versioned `/v1` routes
- a CLI with `serve`, `login`, `logout`, `status`, `models`, and `chat`
- Codex PKCE login and manual completion
- local callback handling
- session persistence and refresh
- real Codex capabilities
- real Codex chat transport

## HTTP API

- `GET /v1/health`
- `GET /v1/auth/state`
- `POST /v1/auth/login`
- `POST /v1/auth/complete`
- `POST /v1/auth/logout`
- `GET /v1/providers/codex/options`
- `POST /v1/chat`
- `POST /v1/chat/stream`

## Run

From the repository root:

```bash
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli serve
```

## CLI

```bash
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli login
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli status
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli models
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli chat "Explain this repository."
```

## Test

```bash
npm run test:python:broker
```

## Purpose

The package now provides the Python-first broker implementation for the migration path.
