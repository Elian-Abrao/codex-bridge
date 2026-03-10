# Testing Guide

## Goal

This repository uses three testing levels for the broker and one separate suite for the SDK.

## Broker Test Levels

### Unit

Location:

- `tests/unit`

Purpose:

- validate application services and adapters in isolation
- keep feedback fast
- avoid real network calls

Examples:

- auth orchestration through fake ports
- session store persistence and compatibility logic

### Integration

Location:

- `tests/integration`

Purpose:

- validate runtime composition
- validate the HTTP API contract
- exercise the in-process HTTP server with a real runtime instance

### End-to-End

Location:

- `tests/e2e`

Purpose:

- validate the package entrypoint as a user would invoke it
- exercise CLI behavior through `python -m codex_bridge`

## SDK Tests

Location:

- `sdk/tests`

Purpose:

- validate the HTTP client behavior
- validate SSE parsing and error mapping

## Automated Commands

Broker:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
```

SDK:

```bash
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```

Bytecode sanity:

```bash
PYTHONPATH=src python -m compileall src
PYTHONPATH=sdk/src python -m compileall sdk/src sdk/examples
```

## Manual Local Validation

1. Install locally:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
pip install -e ./sdk
```

2. Start the broker:

```bash
codex-bridge serve
```

3. Check health and state:

```bash
curl http://127.0.0.1:47831/v1/health
curl http://127.0.0.1:47831/v1/auth/state
curl http://127.0.0.1:47831/v1/providers/codex/options
```

4. Authenticate if needed:

```bash
codex-bridge login
```

5. Send a prompt:

```bash
codex-bridge chat "Reply with OK only."
codex-bridge chat --stream "Reply with OK only."
codex-bridge chat --interactive
```

Inside the interactive session, validate the slash commands:

- `/status`
- `/reset`
- `/model gpt-5.4`
- `/reasoning medium`
- `/logout`

`/logout` should clear the saved local session and exit the interactive loop.

6. Exercise the terminal-oriented commands:

```bash
codex-bridge whoami
codex-bridge models
codex-bridge doctor
codex-bridge version
codex-bridge --json status
```

Or through HTTP:

```bash
curl -X POST http://127.0.0.1:47831/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-5.4",
    "reasoningEffort": "medium",
    "messages": [
      { "role": "user", "content": "Reply with OK only." }
    ]
  }'
```
