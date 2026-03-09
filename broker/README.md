# Python Broker

This folder contains the Python-first broker runtime that will replace the current Node-first runtime over time.

## Status

This is a skeleton package.

It currently provides:

- a Python package layout for the broker
- a local HTTP server with versioned `/v1` routes
- a CLI with a `serve` command
- static Codex capabilities and empty auth state

It does not yet provide:

- OAuth login
- callback handling
- session persistence
- token refresh
- Codex chat transport

## Run

From the repository root:

```bash
PYTHONPATH=broker/src python3 -m codex_bridge_broker.cli serve
```

## Test

```bash
npm run test:python:broker
```

## Purpose

The package exists to make the Python-first migration concrete.

It should become the canonical broker runtime once auth, session, and chat parity are implemented.
