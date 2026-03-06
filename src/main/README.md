# Main

Esta pasta contem a integracao do bridge com o processo principal do Electron.

## Responsabilidade

- instanciar `AuthService`
- montar a `ProviderFacade`
- registrar handlers IPC
- manter a logica sensivel fora do renderer

## Arquivos

- [`index.ts`](./index.ts): cria o runtime Electron via `createElectronBridgeRuntime()`.

## Subpastas

- [auth](./auth/README.md): autenticacao PKCE, sessao e refresh.
- [ipc](./ipc/README.md): handlers entre renderer e main.
- [network](./network/README.md): facade e adapters de provider.

## Quando Usar

Use esta camada quando o `codex-bridge` estiver embutido em um app Electron, em vez de rodar apenas como servidor local independente.

## Veja Tambem

- [README raiz](../../README.md)
- [preload](../preload/README.md)
- [server](../server/README.md)
