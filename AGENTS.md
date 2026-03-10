# codex-bridge Agent Guide

## Product Definition

- `codex-bridge` is a Python-only local broker for Codex authentication and chat access.
- The broker is the primary product in this repository.
- The Python SDK under `sdk/` is a separate client package that consumes the broker over HTTP.
- The public HTTP contract is versioned under `/v1`.
- The public product scope is Codex-only.

## Current Architecture

The package is intentionally layered:

- `src/codex_bridge/domain`
  - entities, policies, callbacks, and ports
- `src/codex_bridge/app`
  - orchestration of auth and chat workflows
- `src/codex_bridge/infra`
  - callback server, OAuth gateway, Codex HTTP gateway, session storage
- `src/codex_bridge/interfaces`
  - CLI and HTTP surface
- `src/codex_bridge/bootstrap`
  - config loading and runtime composition

The main runtime composition happens in:

- `src/codex_bridge/bootstrap/runtime.py`

The public CLI entrypoint lives in:

- `src/codex_bridge/interfaces/cli.py`

The public HTTP API lives in:

- `src/codex_bridge/interfaces/http/api.py`
- `src/codex_bridge/interfaces/http/server.py`

## Repository Layout

- `src/codex_bridge/`: broker package
- `tests/unit/`: isolated broker tests
- `tests/integration/`: runtime and HTTP integration tests
- `tests/e2e/`: subprocess-level CLI smoke tests
- `sdk/`: separate Python SDK package and examples
- `docs/`: architecture, testing, ADRs, and release docs

## Engineering Rules

- Do not reintroduce Node, Electron, or multi-provider abstractions.
- Keep `domain` free of network, filesystem, CLI, and server concerns.
- Keep orchestration logic in `app`.
- Keep concrete integrations in `infra`.
- Keep CLI and HTTP concerns in `interfaces`.
- Keep composition and environment loading in `bootstrap`.
- Keep the SDK thin. It should not duplicate OAuth, refresh, or Codex transport logic.
- Treat `/v1` as the main integration boundary for external consumers.

## Testing Rules

Run broker tests with:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
```

Run SDK tests with:

```bash
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```

Expected test split:

- `unit`
  - pure logic and adapter tests
- `integration`
  - runtime wiring and HTTP API behavior
- `e2e`
  - CLI/module-entry smoke tests

## Operational Commands

Typical local workflow:

```bash
pip install -e .
pip install -e ./sdk
codex-bridge login
codex-bridge serve
codex-bridge status
codex-bridge models
codex-bridge chat "Reply with OK only."
```

## Documentation Rules

When architecture changes:

- update `README.md`
- update `docs/ARCHITECTURE.md`
- update `docs/TESTING.md` when test flow changes
- update `docs/PUBLISHING.md` when packaging or release flow changes
- add or update an ADR in `docs/adr/` for structural decisions

## Delivery Standard

This repository should remain:

- Python-only
- Codex-only
- layered and modular
- CLI-operable
- API-versioned
- documented for local use, testing, and publishing
