import { createHash, randomBytes } from "node:crypto";

export type PkcePair = {
  verifier: string;
  challenge: string;
};

export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function toFormUrlEncoded(
  data: Record<string, string | number | boolean | undefined>
): string {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
}
