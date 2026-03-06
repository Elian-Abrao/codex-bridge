import type { AuthStateSnapshot, StartLoginResult } from "./auth.js";
import type { StreamEvent, StreamRequest } from "./network.js";

export type Unsubscribe = () => void;

export type RendererBridge = {
  auth: {
    startLogin: () => Promise<StartLoginResult>;
    completeManualLogin: (redirectUrl: string) => Promise<void>;
    getState: () => Promise<AuthStateSnapshot>;
    logout: () => Promise<void>;
    onStateChanged: (listener: (state: AuthStateSnapshot) => void) => Unsubscribe;
  };
  ai: {
    startStream: (request: StreamRequest) => Promise<{ requestId: string }>;
    abortStream: (requestId: string) => Promise<void>;
    onStreamEvent: (listener: (event: StreamEvent) => void) => Unsubscribe;
  };
};
