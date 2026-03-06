import { ipcMain, shell } from "electron";
import { IPC_CHANNELS } from "../../shared/ipc.js";
import type { StreamRequest } from "../../shared/network.js";
import type { AuthService } from "../auth/auth-service.js";
import type { ProviderFacade } from "../network/facade.js";
import { broadcastAuthState } from "./channels.js";

export type RegisterIpcOptions = {
  authService: AuthService;
  providerFacade: ProviderFacade;
};

export function registerIpcHandlers(options: RegisterIpcOptions): () => void {
  const { authService, providerFacade } = options;

  const onAuthStateChanged = () => {
    broadcastAuthState(authService.getState());
  };

  authService.on("state-changed", onAuthStateChanged);

  ipcMain.handle(IPC_CHANNELS.authStartLogin, async () => {
    return await authService.startLogin(async (url) => {
      await shell.openExternal(url);
    });
  });

  ipcMain.handle(IPC_CHANNELS.authCompleteManualLogin, async (_event, redirectUrl: string) => {
    await authService.completeManualLogin(redirectUrl);
  });

  ipcMain.handle(IPC_CHANNELS.authGetState, async () => {
    return authService.getState();
  });

  ipcMain.handle(IPC_CHANNELS.authLogout, async () => {
    await authService.logout();
  });

  ipcMain.handle(IPC_CHANNELS.aiStartStream, async (event, request: StreamRequest) => {
    return await providerFacade.startStream(event.sender, request);
  });

  ipcMain.handle(IPC_CHANNELS.aiAbortStream, async (_event, requestId: string) => {
    await providerFacade.abortStream(requestId);
  });

  broadcastAuthState(authService.getState());

  return () => {
    authService.off("state-changed", onAuthStateChanged);
    ipcMain.removeHandler(IPC_CHANNELS.authStartLogin);
    ipcMain.removeHandler(IPC_CHANNELS.authCompleteManualLogin);
    ipcMain.removeHandler(IPC_CHANNELS.authGetState);
    ipcMain.removeHandler(IPC_CHANNELS.authLogout);
    ipcMain.removeHandler(IPC_CHANNELS.aiStartStream);
    ipcMain.removeHandler(IPC_CHANNELS.aiAbortStream);
  };
}
