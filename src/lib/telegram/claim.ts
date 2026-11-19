import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Open on the website" link from the bot. Trackers have no accounts, so a browser proves ownership with a cookie; this link lets
 * the Telegram chat that owns trackers hand that proof to any browser. It is signed (HMAC with the webhook secret), carries the
 * chat id, expires after ten minutes and works once.
 */
export const CLAIM_TTL_MS = 10 * 60_000;

export const claimSecret = (): string | undefined => process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined;

const sign = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

export function makeClaimToken(chatId: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(`${chatId}.${now + CLAIM_TTL_MS}.${randomBytes(9).toString("base64url")}`).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export interface Claim {
  chatId: string;
  nonce: string;
}

export function verifyClaimToken(token: string, secret: string, now = Date.now()): Claim | null {
  const [payload, mac, ...extra] = token.split(".");
  if (!payload || !mac || extra.length) return null;
  const a = Buffer.from(mac);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [chatId, exp, nonce] = Buffer.from(payload, "base64url").toString().split(".");
  if (!chatId || !nonce || !(Number(exp) > now)) return null;
  return { chatId, nonce };
}

const g = globalThis as { __claimUsed?: Map<string, number> };
/** True the first time a nonce is seen. Kept in memory: a restart can only re-open a link that would have expired anyway or is within its ten minutes. */
export function consumeClaim(nonce: string, now = Date.now()): boolean {
  const used = (g.__claimUsed ??= new Map());
  for (const [n, until] of used) if (until < now) used.delete(n);
  if (used.has(nonce)) return false;
  used.set(nonce, now + CLAIM_TTL_MS);
  return true;
}
