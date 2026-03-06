export const IPC_CHANNELS = {
  authStartLogin: "auth:start-login",
  authCompleteManualLogin: "auth:complete-manual-login",
  authGetState: "auth:get-state",
  authLogout: "auth:logout",
  authStateChanged: "auth:state-changed",
  aiStartStream: "ai:start-stream",
  aiAbortStream: "ai:abort-stream",
  aiStreamEvent: "ai:stream-event"
} as const;
