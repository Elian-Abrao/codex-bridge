import { createServer, request as httpRequest, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

export type CallbackPayload = {
  code: string;
  state: string;
};

export type CallbackServerOptions = {
  host: string;
  port: number;
  callbackPath: string;
  cancelPath: string;
  expectedState: string;
  timeoutMs: number;
  successTitle: string;
  successMessage: string;
};

function buildHtmlResponse(title: string, message: string): string {
  return [
    "<!doctype html>",
    "<html>",
    "<head><meta charset=\"utf-8\" /></head>",
    `<body><h2>${title}</h2><p>${message}</p></body>`,
    "</html>"
  ].join("");
}

function createError(code: string, message: string): Error {
  const error = new Error(message);
  error.name = code;
  return error;
}

function normalizeInput(input: string): URL {
  const trimmed = input.trim();
  if (!trimmed) {
    throw createError("ERR_OAUTH_INPUT_EMPTY", "Paste the full redirect URL containing code and state.");
  }

  try {
    return new URL(trimmed);
  } catch {
    const queryOnly = trimmed.startsWith("?") ? trimmed : `?${trimmed}`;
    return new URL(`http://localhost${queryOnly}`);
  }
}

export function parseManualCallbackInput(input: string, expectedState: string): CallbackPayload {
  const url = normalizeInput(input);
  const code = url.searchParams.get("code")?.trim();
  const state = url.searchParams.get("state")?.trim();

  if (!code) {
    throw createError("ERR_OAUTH_CODE_MISSING", "Redirect URL is missing the authorization code.");
  }

  if (!state) {
    throw createError("ERR_OAUTH_STATE_MISSING", "Redirect URL is missing the state parameter.");
  }

  if (state !== expectedState) {
    throw createError("ERR_OAUTH_STATE_MISMATCH", "OAuth state mismatch. The login flow was rejected to prevent CSRF.");
  }

  return { code, state };
}

async function requestCancellation(host: string, port: number, cancelPath: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const req = httpRequest(
      {
        host,
        port,
        method: "GET",
        path: cancelPath,
        timeout: 2_000
      },
      (response) => {
        response.resume();
        response.once("end", () => resolve());
      }
    );

    req.once("timeout", () => {
      req.destroy();
      resolve();
    });
    req.once("error", () => resolve());
    req.end();
  });
}

export class LocalCallbackServer {
  readonly #options: CallbackServerOptions;
  readonly #completion: Promise<CallbackPayload>;
  #server?: Server;
  #resolve!: (payload: CallbackPayload) => void;
  #reject!: (error: Error) => void;
  #settled = false;
  #timeout?: NodeJS.Timeout;

  constructor(options: CallbackServerOptions) {
    this.#options = options;
    this.#completion = new Promise<CallbackPayload>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  async start(): Promise<void> {
    await this.listenWithCancellationRetry();
    this.#timeout = setTimeout(() => {
      this.fail(createError("ERR_OAUTH_TIMEOUT", "OAuth callback timed out after 5 minutes."));
    }, this.#options.timeoutMs);
  }

  waitForCompletion(): Promise<CallbackPayload> {
    return this.#completion;
  }

  async close(): Promise<void> {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = undefined;
    }

    const server = this.#server;
    if (!server) {
      return;
    }

    this.#server = undefined;
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }

  private async listenWithCancellationRetry(): Promise<void> {
    let attemptedCancellation = false;

    while (true) {
      try {
        await this.listenOnce();
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EADDRINUSE" && !attemptedCancellation) {
          attemptedCancellation = true;
          await requestCancellation(
            this.#options.host,
            this.#options.port,
            this.#options.cancelPath
          );
          await delay(200);
          continue;
        }
        throw error;
      }
    }
  }

  private async listenOnce(): Promise<void> {
    const server = createServer((request, response) => {
      void this.handleRequest(request, response);
    });
    this.#server = server;

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(this.#options.port, this.#options.host);
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(
      request.url ?? "/",
      `http://${this.#options.host}:${this.#options.port}`
    );

    if (url.pathname === this.#options.cancelPath) {
      response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Login cancelled.");
      this.fail(createError("ERR_OAUTH_CANCELLED", "OAuth login was cancelled."));
      return;
    }

    if (url.pathname !== this.#options.callbackPath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found.");
      return;
    }

    const errorCode = url.searchParams.get("error")?.trim();
    if (errorCode) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Authentication failed: ${errorCode}`);
      this.fail(createError("ERR_OAUTH_PROVIDER", `OAuth provider returned ${errorCode}.`));
      return;
    }

    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim();

    if (!code) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Missing authorization code.");
      this.fail(createError("ERR_OAUTH_CODE_MISSING", "OAuth callback did not include a code."));
      return;
    }

    if (!state || state !== this.#options.expectedState) {
      response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Invalid OAuth state.");
      this.fail(
        createError("ERR_OAUTH_STATE_MISMATCH", "OAuth state mismatch. The login flow was rejected.")
      );
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      buildHtmlResponse(this.#options.successTitle, this.#options.successMessage)
    );
    this.succeed({ code, state });
  }

  private succeed(payload: CallbackPayload): void {
    if (this.#settled) {
      return;
    }
    this.#settled = true;
    void this.close();
    this.#resolve(payload);
  }

  private fail(error: Error): void {
    if (this.#settled) {
      return;
    }
    this.#settled = true;
    void this.close();
    this.#reject(error);
  }
}
