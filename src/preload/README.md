# Preload

This folder contains the safe bridge exposed to the renderer in Electron mode.

## Responsibility

- expose a minimal surface through `contextBridge`
- wrap `ipcRenderer`
- keep the frontend isolated from sensitive Node APIs

## Files

- [`index.ts`](./index.ts): publishes `window.codexBridge`.

## Exposed API

- `auth.startLogin()`
- `auth.completeManualLogin()`
- `auth.getState()`
- `auth.logout()`
- `auth.onStateChanged()`
- `ai.startStream()`
- `ai.abortStream()`
- `ai.onStreamEvent()`

## See Also

- [main](../main/README.md)
- [ipc](../main/ipc/README.md)
- [shared](../shared/README.md)
