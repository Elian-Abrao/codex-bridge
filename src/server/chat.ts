import type { ProviderFacade } from "../main/network/facade.js";
import type { StreamRequest } from "../shared/network.js";
import type { BridgeChatResponse } from "../shared/bridge.js";

export async function runBridgeChat(params: {
  providerFacade: ProviderFacade;
  request: StreamRequest;
}): Promise<BridgeChatResponse> {
  let outputText = "";
  let streamError: string | undefined;

  const stream = await params.providerFacade.stream({
    request: params.request,
    onEvent: async (event) => {
      if (event.kind === "delta") {
        outputText += event.delta;
        return;
      }

      if (event.kind === "error") {
        streamError = event.message;
      }
    }
  });

  await stream.completed;

  if (streamError) {
    throw new Error(streamError);
  }

  return {
    requestId: stream.requestId,
    provider: params.request.provider,
    model: params.request.model,
    outputText
  };
}
