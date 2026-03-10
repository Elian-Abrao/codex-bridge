# ADR 0001: Layered Broker Architecture

## Status

Accepted

## Context

`codex-bridge` started as a smaller Python broker after a previous mixed runtime approach. As the broker matured, the package still had large modules that mixed:

- application workflows
- OAuth and Codex HTTP details
- filesystem and keyring persistence
- CLI and HTTP interface concerns

That shape made growth possible, but it was not the cleanest base for long-term maintenance.

## Decision

The broker now uses an explicit layered architecture:

- `domain`
  - entities, policies, and ports
- `app`
  - application services and orchestration
- `infra`
  - adapters for callback, OAuth, Codex transport, and storage
- `interfaces`
  - CLI and HTTP entrypoints
- `bootstrap`
  - runtime assembly and configuration

The HTTP API under `/v1` remains the canonical integration boundary.

## Consequences

Positive:

- auth and chat flows are easier to test without real network calls
- adapters can evolve without rewriting orchestration logic
- CLI and HTTP stay thinner and easier to reason about
- the package has a cleaner path for future growth

Tradeoffs:

- there are more modules to navigate
- some indirection is introduced through ports and adapters

## Follow-up Rules

- new workflow logic belongs in `app`
- new pure rules belong in `domain`
- new concrete integrations belong in `infra`
- new public surfaces belong in `interfaces`
