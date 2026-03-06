# codex-bridge

Bridge local para autenticacao e chat com provedores de IA, com foco em reutilizacao entre projetos Electron e apps Node.

## O Que E

O `codex-bridge` separa o problema em 4 camadas:

- autenticacao e sessao
- transporte para providers
- servidor local reutilizavel
- integracao opcional com Electron

Com isso, seus projetos consumidores falam com uma API local ou com um SDK, em vez de reimplementar OAuth, refresh de token e detalhes de cada backend.

## Principios

- PKCE com `code_verifier` e `code_challenge` em `S256`.
- Callback loopback em `127.0.0.1:1455/auth/callback`.
- `state` aleatorio e distinto do verifier, validado de forma estrita para CSRF.
- Timeout de 5 minutos no servidor local com fechamento automatico.
- Fallback manual por colagem da URL de redirect.
- Sessao e refresh centralizados no runtime, sem expor tokens ao frontend.
- Facade de provedores para manter UI e clientes agnosticos ao backend.

## Modos De Uso

### 1. Bridge Local

O projeto sobe um servidor HTTP em loopback e outros apps consomem seus endpoints.

### 2. SDK Cliente

Um projeto Node consome o bridge local via `createChatClient()`.

### 3. Integracao Electron

Um app Electron pode embutir o runtime no `main process` e expor apenas a bridge segura no `preload`.

## Modo Bridge Local

Suba o servidor local:

```bash
npm install
npm run build
npm run serve
```

Healthcheck:

```bash
curl http://127.0.0.1:47831/health
```

Iniciar login Codex:

```bash
curl -X POST http://127.0.0.1:47831/auth/login
```

O `provider` em `/chat` e `/chat/stream` e opcional. Quando omitido, o padrao e `codex`.

Chat sincrono:

```bash
curl -X POST http://127.0.0.1:47831/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Responda com uma frase curta." }
    ]
  }'
```

Streaming:

```bash
curl -N -X POST http://127.0.0.1:47831/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Responda com uma frase curta." }
    ]
  }'
```

CLI interativo:

```bash
npm run chat:codex
```

## Uso Em Outro Projeto

Via SDK:

```ts
import { createChatClient } from "codex-bridge";

const client = createChatClient({
  baseUrl: "http://127.0.0.1:47831"
});

const reply = await client.chat({
  messages: [{ role: "user", content: "Explique este arquivo." }]
});

console.log(reply.outputText);
```

Via HTTP:

```bash
curl -X POST http://127.0.0.1:47831/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [
      { "role": "user", "content": "Resuma este arquivo." }
    ]
  }'
```

## Documentacao Por Pasta

- [src/client](./src/client/README.md)
- [src/cli](./src/cli/README.md)
- [src/main](./src/main/README.md)
- [src/main/auth](./src/main/auth/README.md)
- [src/main/ipc](./src/main/ipc/README.md)
- [src/main/network](./src/main/network/README.md)
- [src/main/network/providers](./src/main/network/providers/README.md)
- [src/preload](./src/preload/README.md)
- [src/server](./src/server/README.md)
- [src/shared](./src/shared/README.md)

## Estrutura

```text
src/
  client/    SDK para consumir o bridge local
  cli/       Entradas de terminal
  main/      Runtime Electron
  preload/   API segura exposta ao renderer
  server/    Bridge local HTTP
  shared/    Tipos e contratos compartilhados
```
