# Network

Esta pasta contem a camada de rede do bridge.

## Responsabilidade

- abstrair provedores distintos por uma unica interface
- preparar headers, endpoint e payload por provider
- consumir SSE
- emitir eventos de status, delta, erro e conclusao

## Arquivos

- [`facade.ts`](./facade.ts): API central para requests e streaming.
- [`provider-registry.ts`](./provider-registry.ts): contratos de adapter e configuracao runtime.
- [`streaming.ts`](./streaming.ts): reexporta o parser SSE compartilhado.

## Conceito Central

A UI e os consumidores do bridge nao devem conhecer detalhes de `codex`, `openai` ou `gemini`. Essa traducao acontece aqui.

## Subpasta

- [providers](./providers/README.md): adapters concretos por backend.

## Veja Tambem

- [main](../README.md)
- [server](../../server/README.md)
- [shared](../../shared/README.md)
