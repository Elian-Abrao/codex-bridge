# CLI

Esta pasta contem os pontos de entrada para uso do bridge pelo terminal.

## Responsabilidade

- subir o servidor HTTP local
- abrir um chat interativo no terminal
- reutilizar a mesma infraestrutura de auth e rede do runtime principal

## Arquivos

- [`serve.ts`](./serve.ts): sobe o bridge local em loopback.
- [`chat-codex.ts`](./chat-codex.ts): inicia um terminal interativo com login, historico e streaming.

## Comandos

```bash
npm run serve
npm run chat:codex
```

## Variaveis de Ambiente

- `CODEX_BRIDGE_PORT`
- `CODEX_BRIDGE_MODEL`
- `CODEX_BRIDGE_URL`
- `CODEX_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `GEMINI_API_KEY`
- `GEMINI_BASE_URL`

## Veja Tambem

- [README raiz](../../README.md)
- [server](../server/README.md)
- [client](../client/README.md)
