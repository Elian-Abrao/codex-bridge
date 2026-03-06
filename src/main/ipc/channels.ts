import { webContents } from "electron";
import type { AuthStateSnapshot } from "../../shared/auth.js";
import { IPC_CHANNELS } from "../../shared/ipc.js";

export function broadcastAuthState(state: AuthStateSnapshot): void {
  for (const contents of webContents.getAllWebContents()) {
    if (!contents.isDestroyed()) {
      contents.send(IPC_CHANNELS.authStateChanged, state);
    }
  }
}
