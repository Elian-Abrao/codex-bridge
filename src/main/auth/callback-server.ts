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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtmlResponse(title: string, message: string): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    `<title>${safeTitle}</title>`,
    "<style>",
    ":root {",
    "  color-scheme: light;",
    "  --bg: #f4efe4;",
    "  --ink: #14211f;",
    "  --muted: #586461;",
    "  --card: rgba(255, 252, 246, 0.92);",
    "  --accent: #1c8c63;",
    "  --accent-strong: #0f6b4a;",
    "  --ring: rgba(28, 140, 99, 0.16);",
    "}",
    "* { box-sizing: border-box; }",
    "body {",
    "  margin: 0;",
    "  min-height: 100vh;",
    "  display: grid;",
    "  place-items: center;",
    "  padding: 24px;",
    "  background:",
    "    radial-gradient(circle at top left, rgba(28, 140, 99, 0.18), transparent 30%),",
    "    radial-gradient(circle at bottom right, rgba(15, 107, 74, 0.16), transparent 32%),",
    "    linear-gradient(160deg, #f6f1e7 0%, #efe6d5 45%, #e9dfcb 100%);",
    "  color: var(--ink);",
    "  font-family: \"Avenir Next\", \"Segoe UI\", sans-serif;",
    "}",
    ".shell {",
    "  width: min(720px, 100%);",
    "  position: relative;",
    "}",
    ".shell::before {",
    "  content: \"\";",
    "  position: absolute;",
    "  inset: -16px 32px auto;",
    "  height: 120px;",
    "  background: linear-gradient(90deg, rgba(28, 140, 99, 0.16), rgba(15, 107, 74, 0));",
    "  filter: blur(36px);",
    "  z-index: 0;",
    "}",
    ".card {",
    "  position: relative;",
    "  z-index: 1;",
    "  overflow: hidden;",
    "  padding: 32px 30px 26px;",
    "  border: 1px solid rgba(20, 33, 31, 0.08);",
    "  border-radius: 28px;",
    "  background: var(--card);",
    "  box-shadow:",
    "    0 28px 80px rgba(20, 33, 31, 0.14),",
    "    inset 0 1px 0 rgba(255, 255, 255, 0.65);",
    "}",
    ".eyebrow {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 10px;",
    "  padding: 8px 14px;",
    "  border-radius: 999px;",
    "  background: var(--ring);",
    "  color: var(--accent-strong);",
    "  font-size: 12px;",
    "  font-weight: 700;",
    "  letter-spacing: 0.12em;",
    "  text-transform: uppercase;",
    "}",
    ".eyebrow::before {",
    "  content: \"\";",
    "  width: 10px;",
    "  height: 10px;",
    "  border-radius: 999px;",
    "  background: linear-gradient(180deg, #2fd08f, var(--accent));",
    "  box-shadow: 0 0 0 5px rgba(28, 140, 99, 0.16);",
    "}",
    "h1 {",
    "  margin: 22px 0 10px;",
    "  font-size: clamp(32px, 6vw, 56px);",
    "  line-height: 0.96;",
    "  letter-spacing: -0.04em;",
    "}",
    "p {",
    "  margin: 0;",
    "  font-size: 17px;",
    "  line-height: 1.6;",
    "  color: var(--muted);",
    "}",
    ".grid {",
    "  display: grid;",
    "  gap: 14px;",
    "  margin-top: 24px;",
    "  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));",
    "}",
    ".tile {",
    "  padding: 16px 18px;",
    "  border-radius: 18px;",
    "  border: 1px solid rgba(20, 33, 31, 0.08);",
    "  background: rgba(255, 255, 255, 0.58);",
    "}",
    ".label {",
    "  display: block;",
    "  margin-bottom: 8px;",
    "  color: var(--accent-strong);",
    "  font-size: 12px;",
    "  font-weight: 700;",
    "  letter-spacing: 0.08em;",
    "  text-transform: uppercase;",
    "}",
    ".value {",
    "  display: block;",
    "  color: var(--ink);",
    "  font-size: 15px;",
    "  line-height: 1.45;",
    "}",
    ".actions {",
    "  display: flex;",
    "  flex-wrap: wrap;",
    "  gap: 12px;",
    "  margin-top: 28px;",
    "}",
    ".button {",
    "  appearance: none;",
    "  border: 0;",
    "  border-radius: 999px;",
    "  padding: 13px 18px;",
    "  background: linear-gradient(180deg, #20996c, var(--accent-strong));",
    "  color: #f7fff9;",
    "  font: inherit;",
    "  font-weight: 700;",
    "  cursor: pointer;",
    "  box-shadow: 0 16px 28px rgba(15, 107, 74, 0.22);",
    "}",
    ".hint {",
    "  margin-top: 18px;",
    "  font-size: 13px;",
    "  color: var(--muted);",
    "}",
    "@media (max-width: 640px) {",
    "  body { padding: 18px; }",
    "  .card { padding: 24px 20px 22px; border-radius: 24px; }",
    "  p { font-size: 16px; }",
    "}",
    "</style>",
    "</head>",
    "<body>",
    "<main class=\"shell\">",
    "<section class=\"card\">",
    "<div class=\"eyebrow\">Codex Bridge Authorized</div>",
    `<h1>${safeTitle}</h1>`,
    `<p>${safeMessage}</p>`,
    "<div class=\"grid\">",
    "<article class=\"tile\">",
    "<span class=\"label\">Access</span>",
    "<span class=\"value\">Your codex-bridge session is now available for local use.</span>",
    "</article>",
    "<article class=\"tile\">",
    "<span class=\"label\">Next Step</span>",
    "<span class=\"value\">Return to the terminal or app window and continue your session.</span>",
    "</article>",
    "</div>",
    "<div class=\"actions\">",
    "<button class=\"button\" type=\"button\" onclick=\"window.close()\">Close this tab</button>",
    "</div>",
    "<div class=\"hint\">If this tab does not close automatically, you can close it manually.</div>",
    "</section>",
    "</main>",
    "</body>",
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
