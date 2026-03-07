# Shared

This folder contains the contracts shared by the runtime, server, preload layer, and client.

## Responsibility

- authentication types
- chat and streaming types
- local HTTP bridge types
- IPC channel definitions
- the API contract exposed to the renderer
- a reusable SSE parser

## Files

- [`auth.ts`](./auth.ts): session and authentication state types.
- [`network.ts`](./network.ts): chat messages, reasoning metadata, and streaming events.
- [`bridge.ts`](./bridge.ts): local HTTP bridge contracts, provider capabilities, and chat request types.
- [`ipc.ts`](./ipc.ts): IPC channel names.
- [`preload.ts`](./preload.ts): TypeScript contract for `window.codexBridge`.
- [`sse.ts`](./sse.ts): shared Server-Sent Events parser.

## Usage Rule

If a type must be known by more than one layer, it should live here. That keeps the client, server, and Electron runtime aligned.

## See Also

- [client](../client/README.md)
- [server](../server/README.md)
- [main](../main/README.md)
