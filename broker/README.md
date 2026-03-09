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
npm run serve
```

## CLI

```bash
npm run login
npm run status
npm run models
npm run chat -- "Explain this repository."
```

## Test

```bash
npm run test:python:broker
```

## Purpose

The package now provides the Python-first broker implementation for the migration path.

## Storage

The broker now supports:

- OS keyring storage when the optional `keyring` dependency is installed
- JSON file fallback when keyring support is unavailable

To prepare a secure local install:

```bash
pip install './broker[secure]'
```
