# codex-bridge Agent Guide

This repository is being repositioned.

## Product Direction

- Treat `codex-bridge` as a local Codex broker.
- The target product is Python-first.
- The product scope is Codex-only.
- The broker is the main deliverable.
- The CLI exists to operate the broker.
- SDKs exist to consume the broker over HTTP.

## Current Reality

- The current production-ready implementation still lives mostly in Node.js.
- The Python broker under `broker/` is the migration target, not full parity yet.
- The Python SDK under `python/` is a client package.
- Electron integration is transitional and should not drive new public-facing architecture decisions.

## Engineering Rules

- Prefer Codex-specific naming and contracts over generic provider abstractions in new code.
- Do not add new providers unless explicitly requested.
- Prefer `/v1` routes for all public HTTP contracts.
- Maintain backward compatibility in the Node bridge only when needed to avoid breaking current consumers.
- Keep SDKs thin. Broker logic belongs in the broker, not in the clients.
- Favor clear operational behavior over framework cleverness.

## Repository Intent

- `broker/`: target Python broker runtime and CLI
- `python/`: Python SDK client for the broker
- `src/server/`: current Node broker runtime
- `src/client/`: current Node client SDK
- `src/main/` and `src/preload/`: transitional Electron integration

## Refactor Priorities

1. Establish Python broker package structure and versioned HTTP API.
2. Move public documentation toward Codex-only broker messaging.
3. Reduce the prominence of Node/Electron paths in product-facing docs.
4. Isolate or retire OpenAI and Gemini code paths once Python broker parity exists.

## Delivery Standard

Call the project professionally deliverable only when it has:

- a canonical Python broker runtime
- a versioned public API
- automated tests for broker behavior
- secure session storage strategy
- documented CLI workflows
- thin, documented SDKs
