type JsonRecord = Record<string, unknown>;

type OpenAiAuthClaims = {
  chatgpt_account_id?: string;
  chatgpt_user_id?: string;
  chatgpt_plan_type?: string;
};

export type TokenClaims = {
  exp?: number;
  email?: string;
  sub?: string;
  openAiAuth?: OpenAiAuthClaims;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function decodeJwtPayload(token: string): JsonRecord | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function extractTokenClaims(token?: string): TokenClaims {
  if (!token) {
    return {};
  }

  const payload = decodeJwtPayload(token);
  if (!payload) {
    return {};
  }

  const auth = payload["https://api.openai.com/auth"];
  const profile = payload["https://api.openai.com/profile"];
  const profileEmail = isRecord(profile) ? readString(profile.email) : undefined;

  return {
    exp: readNumber(payload.exp),
    sub: readString(payload.sub),
    email: readString(payload.email) ?? profileEmail,
    openAiAuth: isRecord(auth)
      ? {
          chatgpt_account_id: readString(auth.chatgpt_account_id),
          chatgpt_user_id: readString(auth.chatgpt_user_id) ?? readString(auth.user_id),
          chatgpt_plan_type: readString(auth.chatgpt_plan_type)
        }
      : undefined
  };
}

export function extractJwtExpiryMs(token?: string): number | undefined {
  const exp = extractTokenClaims(token).exp;
  return exp ? exp * 1000 : undefined;
}

export function extractOpenAiAccountId(token?: string): string | undefined {
  return extractTokenClaims(token).openAiAuth?.chatgpt_account_id;
}

export function extractOpenAiEmail(token?: string): string | undefined {
  return extractTokenClaims(token).email;
}

export function extractOpenAiPlanType(token?: string): string | undefined {
  return extractTokenClaims(token).openAiAuth?.chatgpt_plan_type;
}
