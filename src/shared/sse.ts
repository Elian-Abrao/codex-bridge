export type ParsedSseEvent = {
  event?: string;
  data: string;
};

function parseEnvelope(block: string): ParsedSseEvent | null {
  let event: string | undefined;
  const dataParts: string[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataParts.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataParts.length === 0) {
    return null;
  }

  return {
    event,
    data: dataParts.join("\n")
  };
}

async function dispatchEnvelope(params: {
  block: string;
  onEvent: (event: ParsedSseEvent) => Promise<void> | void;
  cancel: (reason?: unknown) => Promise<void>;
}): Promise<void> {
  const envelope = parseEnvelope(params.block);
  if (!envelope) {
    return;
  }

  try {
    await params.onEvent(envelope);
  } catch (error) {
    await params.cancel(error).catch(() => undefined);
    throw error;
  }
}

export async function consumeServerSentEvents(params: {
  response: Response;
  onEvent: (event: ParsedSseEvent) => Promise<void> | void;
}): Promise<void> {
  if (!params.response.body) {
    throw new Error("Streaming response does not expose a body.");
  }

  const reader = params.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/g);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      await dispatchEnvelope({
        block,
        onEvent: params.onEvent,
        cancel: (reason) => reader.cancel(reason)
      });
    }
  }

  buffer += decoder.decode();
  if (buffer.trim().length > 0) {
    await dispatchEnvelope({
      block: buffer,
      onEvent: params.onEvent,
      cancel: (reason) => reader.cancel(reason)
    });
  }
}
