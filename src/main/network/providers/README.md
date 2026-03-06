# Providers

Esta pasta contem os adapters concretos de cada backend suportado.

## Responsabilidade

Cada adapter sabe:

- como montar a request do provider
- quais headers usar
- como converter eventos SSE em `StreamEvent`

## Arquivos

- [`codex-provider.ts`](./codex-provider.ts): usa sessao OAuth do Codex e suporta `ChatGPT-Account-Id`.
- [`openai-provider.ts`](./openai-provider.ts): usa API key e a API `/v1/responses`.
- [`gemini-provider.ts`](./gemini-provider.ts): usa API key e `streamGenerateContent`.

## Regra de Design

Quando um novo provider for adicionado, a mudanca deve ficar concentrada aqui e no registro da facade, sem vazar regras para o renderer ou para o SDK cliente.

## Veja Tambem

- [network](../README.md)
- [shared](../../../shared/README.md)
