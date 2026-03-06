# Auth

Esta pasta contem o fluxo de autenticacao PKCE e o gerenciamento de sessao.

## Responsabilidade

- gerar `code_verifier`, `code_challenge` e `state`
- subir um callback local em `127.0.0.1:1455`
- trocar `code` por tokens
- persistir sessao
- agendar refresh automatico
- expor estado publico de autenticacao

## Arquivos

- [`auth-service.ts`](./auth-service.ts): orquestra login, callback, persistencia e refresh.
- [`callback-server.ts`](./callback-server.ts): servidor HTTP local temporario para receber o redirect OAuth.
- [`pkce.ts`](./pkce.ts): helpers criptograficos e serializacao de payloads OAuth.
- [`jwt.ts`](./jwt.ts): extrai expiracao e campos uteis do token.
- [`session-store.ts`](./session-store.ts): leitura e escrita da sessao em disco.
- [`provider-definitions.ts`](./provider-definitions.ts): parametros do provedor OAuth.

## Fluxo

1. `startLogin()` cria PKCE e `state`.
2. O browser externo abre a URL de autorizacao.
3. O callback local recebe `code` e valida CSRF.
4. O serviço faz o token exchange.
5. A sessao e salva e o refresh e programado.

## Veja Tambem

- [main](../README.md)
- [server](../../server/README.md)
- [shared](../../shared/README.md)
