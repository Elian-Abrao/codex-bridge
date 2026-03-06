# Shared

Esta pasta contem os contratos compartilhados entre runtime, servidor, preload e cliente.

## Responsabilidade

- tipos de autenticacao
- tipos de chat e streaming
- tipos do bridge HTTP
- canais IPC
- contratos da API exposta ao renderer
- parser SSE reutilizavel

## Arquivos

- [`auth.ts`](./auth.ts): tipos de sessao e estado de autenticacao.
- [`network.ts`](./network.ts): mensagens de chat e eventos de streaming.
- [`bridge.ts`](./bridge.ts): contratos do bridge HTTP local.
- [`ipc.ts`](./ipc.ts): nomes dos canais IPC.
- [`preload.ts`](./preload.ts): contrato TypeScript de `window.codexBridge`.
- [`sse.ts`](./sse.ts): parser compartilhado de Server-Sent Events.

## Regra de Uso

Se um tipo precisa ser conhecido por mais de uma camada, ele deve viver aqui. Isso evita divergencia entre cliente, servidor e Electron.

## Veja Tambem

- [client](../client/README.md)
- [server](../server/README.md)
- [main](../main/README.md)
