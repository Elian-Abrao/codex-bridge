# Auth

This folder contains the PKCE authentication flow and session management.

## Responsibility

- generate `code_verifier`, `code_challenge`, and `state`
- start a local callback server on `127.0.0.1:1455`
- exchange the authorization `code` for tokens
- persist the session
- schedule automatic refresh
- expose public authentication state

## Files

- [`auth-service.ts`](./auth-service.ts): orchestrates login, callback handling, persistence, and refresh.
- [`callback-server.ts`](./callback-server.ts): temporary local HTTP server that receives the OAuth redirect.
- [`pkce.ts`](./pkce.ts): cryptographic helpers and OAuth payload serialization.
- [`jwt.ts`](./jwt.ts): extracts expiration and useful token metadata.
- [`session-store.ts`](./session-store.ts): reads and writes the session on disk.
- [`provider-definitions.ts`](./provider-definitions.ts): OAuth provider parameters.

## Flow

1. `startLogin()` creates PKCE values and `state`.
2. The external browser opens the authorization URL.
3. The local callback receives `code` and validates CSRF state.
4. The service exchanges the code for tokens.
5. The session is saved and refresh is scheduled.

## See Also

- [main](../README.md)
- [server](../../server/README.md)
- [shared](../../shared/README.md)
