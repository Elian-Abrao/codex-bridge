# Server

This folder contains the standalone local bridge runtime.

## Responsibility

- assemble the standalone runtime
- expose the local HTTP API
- turn streamed responses into aggregated output when needed
- act as the integration point between external apps and the runtime

## Files

- [`runtime.ts`](./runtime.ts): creates `AuthService` and `ProviderFacade` outside Electron.
- [`http-server.ts`](./http-server.ts): bridge HTTP endpoints.
- [`chat.ts`](./chat.ts): aggregates deltas into a single response for `POST /chat`.
- [`types.ts`](./types.ts): server configuration types.

## Endpoints

- `GET /health`
- `GET /auth/state`
- `GET /providers/codex/options`
- `POST /auth/login`
- `POST /auth/complete`
- `POST /auth/logout`
- `POST /chat`
- `POST /chat/stream`

## Provider Capabilities

`GET /providers/codex/options` returns a small capabilities document for the `codex` provider:

- whether the bridge currently has an authenticated Codex session
- the authenticated account email when available
- the default model and default reasoning effort
- the available model list
- the supported reasoning effort list

## See Also

- [root README](../../README.md)
- [client](../client/README.md)
- [cli](../cli/README.md)
- [main/auth](../main/auth/README.md)
