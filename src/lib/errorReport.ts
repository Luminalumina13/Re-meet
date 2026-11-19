import { escapeHtml, tgCall } from "@/lib/telegram/api";
import { feedbackConfig } from "@/lib/feedback";

/**
 * Critical server errors go to the owner's Telegram chat, the same one the website's question form uses (FEEDBACK_CHAT_ID, bot
 * FEEDBACK_BOT_TOKEN or TELEGRAM_BOT_TOKEN). Only in production (or with ERROR_REPORTS=1; ERROR_REPORTS=0 turns it off). Nothing
 * here may throw, fail a request or leak a secret: messages are redacted and shortened, repeats are collapsed, and the total is capped.
 */
const DEDUPE_MS = 15 * 60_000;
const HOUR_MS = 60 * 60_000;
const HOURLY_CAP = 20;

const g = globalThis as { __errorReports?: { seen: Map<string, number>; sent: number[] } };
const state = () => (g.__errorReports ??= { seen: new Map(), sent: [] });

export const reportingEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.ERROR_REPORTS === "0" ? false : env.ERROR_REPORTS === "1" || env.NODE_ENV === "production";

/** Removes what must never reach a chat: tokens, keys, e-mail addresses, and long opaque strings. */
export function redact(text: string): string {
  return text
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g, "[bot-token]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/([?&;\s"']?(?:api[_-]?key|key|token|secret|password|authorization|signature|sig)["']?\s*[=:]\s*)[^\s&"',;)]+/gi, "$1[redacted]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
}

const short = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** The message of the Telegram notification: where it happened, what, and the top of the stack without absolute paths. */
export function formatError(where: string, e: unknown, now = new Date()): string {
  const err = e instanceof Error ? e : new Error(typeof e === "string" ? e : "non-error value thrown");
  const frames = (err.stack ?? "")
    .split("\n")
    .slice(1, 4)
    .map((l) => l.trim().replace(/\(?(?:file:\/\/)?\/[^)\s]*?\/(?:\.next|src|node_modules)\//, "(").replace(/^at\s+/, "at "));
  const lines = [`<b>🚨 Re:meeet: помилка сервера</b>`, `<b>Де:</b> ${escapeHtml(short(redact(where), 80))}`, `<code>${escapeHtml(short(redact(`${err.name}: ${err.message}`), 400))}</code>`];
  if (frames.length) lines.push(`<code>${escapeHtml(short(redact(frames.join("\n")), 500))}</code>`);
  lines.push(`<i>${now.toISOString().slice(0, 16).replace("T", " ")} UTC</i>`);
  return lines.join("\n");
}

/** True when this error should be sent now: not the same one within 15 minutes, and at most 20 an hour. */
export function shouldReport(signature: string, now = Date.now()): boolean {
  const s = state();
  s.sent = s.sent.filter((t) => now - t < HOUR_MS);
  if (s.sent.length >= HOURLY_CAP) return false;
  const last = s.seen.get(signature);
  if (last !== undefined && now - last < DEDUPE_MS) return false;
  s.seen.set(signature, now);
  s.sent.push(now);
  if (s.seen.size > 500) for (const [k, t] of s.seen) if (now - t >= DEDUPE_MS) s.seen.delete(k);
  return true;
}

export function resetErrorReports(): void {
  g.__errorReports = undefined;
}

/** Fire and forget: call as `void reportError("API", e)`. */
export async function reportError(where: string, e: unknown): Promise<void> {
  try {
    if (!reportingEnabled()) return;
    const cfg = feedbackConfig();
    if (!cfg) return;
    const err = e instanceof Error ? e : new Error(String(e));
    if (!shouldReport(`${where}|${err.name}|${redact(err.message).slice(0, 120)}`)) return;
    const res = await tgCall("sendMessage", { chat_id: cfg.chatId, text: formatError(where, e), parse_mode: "HTML", link_preview_options: { is_disabled: true } }, cfg.token);
    if (!res.ok) console.warn(`[errorReport] telegram send failed: ${res.errorCode ?? ""} ${res.description ?? ""}`);
  } catch {
    // reporting must never make things worse
  }
}
