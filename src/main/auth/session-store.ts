import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PublicAuthSession } from "../../shared/auth.js";

export type StoredAuthSession = {
  provider: "codex";
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  accountId?: string;
  email?: string;
  planType?: string;
  expiresAt: number;
  updatedAt: number;
};

type AuthSessionFile = {
  version: 1;
  session?: StoredAuthSession;
};

function isStoredAuthSession(value: unknown): value is StoredAuthSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredAuthSession>;
  return (
    candidate.provider === "codex" &&
    typeof candidate.accessToken === "string" &&
    candidate.accessToken.length > 0 &&
    typeof candidate.refreshToken === "string" &&
    candidate.refreshToken.length > 0 &&
    typeof candidate.expiresAt === "number" &&
    typeof candidate.updatedAt === "number"
  );
}

export function toPublicSession(session: StoredAuthSession): PublicAuthSession {
  return {
    provider: session.provider,
    accountId: session.accountId,
    email: session.email,
    planType: session.planType,
    expiresAt: session.expiresAt,
    updatedAt: session.updatedAt
  };
}

export class AuthSessionStore {
  readonly #filePath: string;

  constructor(filePath: string) {
    this.#filePath = filePath;
  }

  async load(): Promise<StoredAuthSession | undefined> {
    try {
      const raw = await readFile(this.#filePath, "utf8");
      const parsed = JSON.parse(raw) as AuthSessionFile;
      return isStoredAuthSession(parsed.session) ? parsed.session : undefined;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  async save(session: StoredAuthSession): Promise<void> {
    await mkdir(dirname(this.#filePath), { recursive: true });
    const next: AuthSessionFile = {
      version: 1,
      session
    };
    const tempPath = `${this.#filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tempPath, this.#filePath);
  }

  async clear(): Promise<void> {
    await mkdir(dirname(this.#filePath), { recursive: true });
    const next: AuthSessionFile = { version: 1 };
    const tempPath = `${this.#filePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tempPath, this.#filePath);
  }
}
