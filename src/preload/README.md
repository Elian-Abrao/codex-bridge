# Preload

Esta pasta contem a bridge segura exposta ao renderer no modo Electron.

## Responsabilidade

- expor uma superficie minima via `contextBridge`
- encapsular `ipcRenderer`
- manter o frontend isolado de APIs Node sensiveis

## Arquivos

- [`index.ts`](./index.ts): publica `window.codexBridge`.

## API Exposta

- `auth.startLogin()`
- `auth.completeManualLogin()`
- `auth.getState()`
- `auth.logout()`
- `auth.onStateChanged()`
- `ai.startStream()`
- `ai.abortStream()`
- `ai.onStreamEvent()`

## Veja Tambem

- [main](../main/README.md)
- [ipc](../main/ipc/README.md)
- [shared](../shared/README.md)
