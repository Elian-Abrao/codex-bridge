# Network

This folder contains the bridge network layer.

## Responsibility

- abstract different providers behind a single interface
- prepare headers, endpoints, and payloads per provider
- consume SSE streams
- emit status, delta, error, and completion events

## Files

- [`facade.ts`](./facade.ts): central API for requests and streaming.
- [`provider-registry.ts`](./provider-registry.ts): adapter contracts and runtime configuration.
- [`streaming.ts`](./streaming.ts): re-exports the shared SSE parser.

## Core Idea

The UI and bridge consumers should not know the details of `codex`, `openai`, or `gemini`. That translation happens here.

## Subfolder

- [providers](./providers/README.md): concrete backend adapters.

## See Also

- [main](../README.md)
- [server](../../server/README.md)
- [shared](../../shared/README.md)
