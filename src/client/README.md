# Client

Esta pasta contem o SDK de consumo do `codex-bridge`.

## Responsabilidade

O cliente encapsula chamadas HTTP para o bridge local e oferece uma API simples para:

- verificar saude do servico
- consultar estado de autenticacao
- iniciar e concluir login
- enviar chat sincrono
- consumir chat em streaming

## Arquivos

- [`index.ts`](./index.ts): implementa `CodexBridgeClient`, `createBridgeClient()` e `createChatClient()`.

## Fluxo

1. Seu projeto instancia o cliente com a URL do bridge.
2. O cliente chama os endpoints locais de auth e chat.
3. O bridge cuida de sessao, refresh e transporte para o provedor.

## Exemplo

```ts
import { createChatClient } from "codex-bridge";

const client = createChatClient({
  baseUrl: "http://127.0.0.1:47831"
});

const response = await client.chat({
  messages: [{ role: "user", content: "Explique esta classe." }]
});
```

## Veja Tambem

- [README raiz](../../README.md)
- [server](../server/README.md)
- [shared](../shared/README.md)
