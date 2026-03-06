# Main

This folder contains the bridge integration for the Electron main process.

## Responsibility

- instantiate `AuthService`
- assemble the `ProviderFacade`
- register IPC handlers
- keep sensitive logic outside the renderer

## Files

- [`index.ts`](./index.ts): creates the Electron runtime through `createElectronBridgeRuntime()`.

## Subfolders

- [auth](./auth/README.md): PKCE authentication, session storage, and refresh.
- [ipc](./ipc/README.md): handlers between renderer and main.
- [network](./network/README.md): provider facade and adapters.

## When To Use It

Use this layer when `codex-bridge` is embedded inside an Electron app instead of running only as a standalone local server.

## See Also

- [root README](../../README.md)
- [preload](../preload/README.md)
- [server](../server/README.md)
