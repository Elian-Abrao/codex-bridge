# codex-bridge Agent Guide

## Product Identity

- `codex-bridge` is a Python-only local Codex broker.
- The broker is the primary product.
- The SDK under `sdk/` is a separate Python client package for the broker.
- The public API is versioned under `/v1`.
- The public product scope is Codex-only.

## Repository Layout

- `src/codex_bridge/`: broker runtime, auth flow, CLI, HTTP API, transport
- `tests/`: broker tests
- `sdk/`: Python SDK package and examples
- `docs/`: architecture and release documentation

## Engineering Rules

- Do not reintroduce Node, Electron, or multi-provider abstractions.
- Prefer explicit Codex naming over generic provider terminology in new code.
- Keep broker logic in the broker package. Keep the SDK thin.
- Treat the HTTP API as the main integration boundary.
- Favor operational clarity over framework complexity.

## Delivery Standard

The repository should stay:

- Python-only
- Codex-only
- CLI-operable
- API-versioned
- documented for local use and publishing
