# Server

Esta pasta contem o modo de execucao como bridge local independente.

## Responsabilidade

- montar runtime standalone
- expor API HTTP local
- transformar streaming em resposta agregada quando necessario
- servir como ponto de integracao entre apps externos e o runtime

## Arquivos

- [`runtime.ts`](./runtime.ts): cria `AuthService` e `ProviderFacade` fora do Electron.
- [`http-server.ts`](./http-server.ts): endpoints HTTP do bridge.
- [`chat.ts`](./chat.ts): agrega deltas em uma resposta unica para `POST /chat`.
- [`types.ts`](./types.ts): configuracao do servidor.

## Endpoints

- `GET /health`
- `GET /auth/state`
- `POST /auth/login`
- `POST /auth/complete`
- `POST /auth/logout`
- `POST /chat`
- `POST /chat/stream`

## Veja Tambem

- [README raiz](../../README.md)
- [client](../client/README.md)
- [cli](../cli/README.md)
- [main/auth](../main/auth/README.md)
