# Migration Plan

This document explains how the current repository will be refactored into the target Python-first product shape.

## Current State

The repository currently contains:

- a Node.js local broker runtime
- Electron-specific runtime integration
- a Node SDK
- a Python SDK
- a CLI for local testing and chat
- generic provider abstractions that still include OpenAI and Gemini

This is a useful base, but it still looks like a multi-purpose lab instead of a focused product.

## What We Keep

These concepts stay:

- Codex PKCE authentication flow
- local callback server behavior
- session persistence and refresh responsibilities
- local HTTP API as the integration boundary
- synchronous and streaming chat endpoints
- CLI as an operator-facing tool
- SDKs as clients of the broker

## What Changes

The center of the product changes from:

- Node/Electron-first runtime

to:

- Python-first local Codex broker

The scope changes from:

- generic multi-provider bridge

to:

- Codex-only broker

## What Will Be Deprecated

The following pieces are expected to become transitional or deprecated:

- generic provider messaging in the root documentation
- OpenAI provider adapter
- Gemini provider adapter
- generic `provider` as a core public input for the main API
- Electron-first framing of the repository
- Node runtime as the canonical broker implementation

Some of these may remain temporarily until Python parity is reached, but they should stop being presented as the main story.

## What Will Be Removed From The Main Product Path

Once the Python broker reaches parity, the main product path should no longer depend on:

- `src/main/network/providers/openai-provider.ts`
- `src/main/network/providers/gemini-provider.ts`
- multi-provider public API positioning
- Electron as the primary documented usage mode

Potential later action:

- move Electron integration into a compatibility or legacy area
- move the Node implementation into a transitional package if we still want it for internal use

## Refactor Phases

### Phase 1. Positioning And Contracts

Goal:

- clarify the product before major code movement

Work:

- update root documentation
- define target architecture
- define the minimum public API
- define what is legacy versus strategic

### Phase 2. Python Broker Skeleton

Goal:

- establish a Python runtime that can become the canonical broker

Work:

- create Python broker package layout
- implement `/v1/health`
- implement `/v1/auth/state`
- implement `/v1/auth/login`
- implement `/v1/auth/complete`
- implement `/v1/auth/logout`
- implement `/v1/providers/codex/options`
- implement `/v1/chat`
- implement `/v1/chat/stream`

### Phase 3. Auth And Session Parity

Goal:

- match current behavior of the Node implementation

Work:

- PKCE generation
- loopback callback server
- manual completion flow
- session persistence
- refresh scheduling
- compatibility normalization for model and reasoning values

### Phase 4. CLI Consolidation

Goal:

- expose a clean operational interface in Python

Work:

- add `serve`
- add `login`
- add `logout`
- add `status`
- add `models`
- add `chat`

### Phase 5. SDK Realignment

Goal:

- make SDKs explicitly client-only

Work:

- keep Python SDK aligned with broker API
- optionally rebuild the JS SDK as a thin HTTP client
- remove duplicated broker logic from clients

### Phase 6. Deprecation Cleanup

Goal:

- remove or isolate legacy code paths

Work:

- stop documenting OpenAI and Gemini as supported product providers
- remove multi-provider positioning from root docs
- isolate or remove Electron-first runtime as a primary path
- archive or move Node broker code if no longer needed

## Acceptance Criteria For The Migration

We should consider the migration successful when:

- the Python broker is the canonical implementation
- the public API is versioned and documented
- the broker is Codex-only
- the CLI operates the Python broker cleanly
- the Python SDK is first-class
- the JavaScript SDK, if kept, is clearly secondary and client-only
- documentation no longer presents the project as Node/Electron-first

## Immediate Next Refactor Steps

The next implementation pass should focus on:

1. creating the Python broker package layout
2. introducing `/v1` HTTP routes in the current server contract
3. isolating Codex-specific logic from generic provider abstractions
4. marking OpenAI and Gemini code paths as non-strategic
5. reducing the prominence of Electron in public-facing documentation
