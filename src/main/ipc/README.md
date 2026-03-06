# IPC

This folder defines the bridge between the renderer and the main process in Electron mode.

## Responsibility

- register `ipcMain` handlers
- route renderer calls to auth and network services
- rebroadcast authentication state events
- rebroadcast streaming events to the UI

## Files

- [`register-ipc.ts`](./register-ipc.ts): registers and removes IPC handlers.
- [`channels.ts`](./channels.ts): broadcast helpers for shared events.

## Security Boundary

The renderer does not access tokens, secrets, or provider requests directly. It only talks to this layer.

## See Also

- [main](../README.md)
- [preload](../../preload/README.md)
- [shared](../../shared/README.md)
