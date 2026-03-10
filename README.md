# codex-bridge

Local Python broker for Codex authentication and chat access.

## What It Is

`codex-bridge` is a local broker that centralizes:

- OAuth PKCE login against the Codex-compatible auth flow
- local session persistence and automatic token refresh
- Codex model and reasoning metadata
- synchronous and streaming chat endpoints
- a terminal-first CLI
- an initial local agent runtime with sessions, permissions, and tools

Applications integrate with the broker over HTTP instead of reimplementing OAuth, callback handling, refresh, and Codex-specific request details.

## Repository Layout

```text
src/codex_bridge/
  app/                application services and use cases
  bootstrap/          configuration and runtime composition
  domain/             entities, agent policies, and ports
  infra/              HTTP/OAuth/storage/tool adapters
  interfaces/         CLI and HTTP entrypoints
tests/
  unit/               pure broker unit tests
  integration/        HTTP API and runtime integration tests
  e2e/                CLI-level smoke tests
sdk/                  separate Python SDK package and examples
docs/                 architecture, ADRs, and publishing guides
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

When the local browser callback succeeds, the CLI completes the login automatically. You do not need to press Enter in the terminal.

Start the local broker:

```bash
codex-bridge serve
```

Inspect current state:

```bash
codex-bridge status
codex-bridge models
codex-bridge whoami
codex-bridge doctor
codex-bridge version
```

Send a quick chat request:

```bash
codex-bridge chat "Explain this repository."
```

`chat` is plain chat mode. It should not pretend to execute local commands or inspect your workspace.

Start an interactive terminal session:

```bash
codex-bridge chat --interactive
```

Interactive mode supports these slash commands:

- `/help`
- `/reset`
- `/model <name>`
- `/reasoning <level>`
- `/status`
- `/logout`
- `/exit`

Use `/logout` to clear the local session and leave the interactive chat immediately.

Start the local agent runtime:

```bash
codex-bridge agent
```

The initial agent mode supports:

- session state
- permission profiles: `read-only`, `workspace-write`, `full-access`
- local tools: `read_file`, `write_file`, `shell`
- model-driven local tool rounds inside the same agent turn

Core agent commands:

- `/status`
- `/permissions [profile]`
- `/tools`
- `/cwd [path]`
- `/read <path>`
- `/write <path> <content>`
- `/shell <command>`

In `agent` mode, Codex can now request a local tool during the turn. The runtime executes the tool, injects the tool output back into the session context, and continues the same turn automatically.

Machine-readable output is available for structured commands:

```bash
codex-bridge --json status
codex-bridge --json doctor
codex-bridge --json models
codex-bridge --json whoami
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

The broker test suite is now organized by scope:

- `tests/unit`: application services and storage adapters
- `tests/integration`: HTTP API and runtime wiring
- `tests/e2e`: CLI execution against the package entrypoint

Run the broker directly from source:

```bash
PYTHONPATH=src python -m codex_bridge serve
```

## How To Test It Locally

1. Create a virtual environment and install the broker:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
pip install -e ./sdk
```

2. Run the automated tests:

```bash
PYTHONPATH=src python -m unittest discover -s tests -p 'test_*.py'
PYTHONPATH=sdk/src python -m unittest discover -s sdk/tests -p 'test_*.py'
```

3. Start the broker:

```bash
codex-bridge serve
```

4. In another terminal, verify the broker:

```bash
curl http://127.0.0.1:47831/v1/health
curl http://127.0.0.1:47831/v1/auth/state
curl http://127.0.0.1:47831/v1/providers/codex/options
```

5. Authenticate if needed:

```bash
codex-bridge login
```

If the browser reaches the success page, the login should finish automatically in the terminal without extra input.

6. Send a real prompt:

```bash
codex-bridge chat "Reply with OK only."
codex-bridge chat --stream "Reply with OK only."
codex-bridge chat --interactive
codex-bridge agent
```

Inside `chat --interactive`, you can use `/logout` to clear the local session and exit the terminal chat.

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

## SDK

The repository also contains a separate Python SDK package in [`sdk/`](./sdk/README.md).

Published package target:

```bash
pip install codex-bridge-sdk
```

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Architecture Decision Record](./docs/adr/0001-layered-architecture.md)
- [Testing](./docs/TESTING.md)
- [Publishing](./docs/PUBLISHING.md)
- [SDK](./sdk/README.md)
