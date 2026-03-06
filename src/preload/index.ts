import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../shared/ipc.js";
import type { AuthStateSnapshot } from "../shared/auth.js";
import type { StreamEvent } from "../shared/network.js";
import type { RendererBridge } from "../shared/preload.js";

const bridge: RendererBridge = {
  auth: {
    startLogin: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.authStartLogin);
    },
    completeManualLogin: async (redirectUrl: string) => {
      await ipcRenderer.invoke(IPC_CHANNELS.authCompleteManualLogin, redirectUrl);
    },
    getState: async () => {
      return await ipcRenderer.invoke(IPC_CHANNELS.authGetState);
    },
    logout: async () => {
      await ipcRenderer.invoke(IPC_CHANNELS.authLogout);
    },
    onStateChanged: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, state: AuthStateSnapshot) => {
        listener(state);
      };

      ipcRenderer.on(IPC_CHANNELS.authStateChanged, handler);
      return () => {
        ipcRenderer.off(IPC_CHANNELS.authStateChanged, handler);
      };
    }
  },
  ai: {
    startStream: async (request) => {
      return await ipcRenderer.invoke(IPC_CHANNELS.aiStartStream, request);
    },
    abortStream: async (requestId: string) => {
      await ipcRenderer.invoke(IPC_CHANNELS.aiAbortStream, requestId);
    },
    onStreamEvent: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, event: StreamEvent) => {
        listener(event);
      };

      ipcRenderer.on(IPC_CHANNELS.aiStreamEvent, handler);
      return () => {
        ipcRenderer.off(IPC_CHANNELS.aiStreamEvent, handler);
      };
    }
  }
};

contextBridge.exposeInMainWorld("codexBridge", bridge);

declare global {
  interface Window {
    codexBridge: RendererBridge;
  }
}
