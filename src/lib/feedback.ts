import { z } from "zod";
import { escapeHtml, tgCall } from "@/lib/telegram/api";

/** Questions from the website form. Delivered to the owner's Telegram chat; nothing is stored on the server. */
export const feedbackSchema = z.object({
  message: z.string().trim().min(5).max(1500),
  contact: z.string().trim().max(120).optional(),
  lang: z.enum(["uk", "en"]).optional(),
  /** Honeypot: a real visitor never sees or fills this field. */
  website: z.string().max(200).optional(),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export function feedbackConfig(env: NodeJS.ProcessEnv = process.env): { token: string; chatId: string } | null {
  const token = (env.FEEDBACK_BOT_TOKEN ?? env.TELEGRAM_BOT_TOKEN)?.trim();
  const chatId = env.FEEDBACK_CHAT_ID?.trim();
  return token && chatId && /^-?\d+$/.test(chatId) ? { token, chatId } : null;
}

/** Fixed-window limiter per client (3 per 10 minutes) plus a global daily ceiling, in memory. */
const PER_CLIENT = 3;
const WINDOW_MS = 10 * 60_000;
const DAILY_CAP = 100;
const g = globalThis as { __feedbackHits?: Map<string, number[]>; __feedbackDay?: { day: string; n: number } };
const hits: Map<string, number[]> = (g.__feedbackHits ??= new Map<string, number[]>());

export function allowFeedback(client: string, now = Date.now()): boolean {
  const day = new Date(now).toISOString().slice(0, 10);
  const total = (g.__feedbackDay = g.__feedbackDay?.day === day ? g.__feedbackDay : { day, n: 0 });
  if (total.n >= DAILY_CAP) return false;
  const recent = (hits.get(client) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_CLIENT) return false;
  hits.set(client, [...recent, now]);
  total.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return true;
}

export function resetFeedbackLimits(): void {
  hits.clear();
  g.__feedbackDay = undefined;
}

export function formatFeedback(f: FeedbackInput): string {
  const lines = ["<b>Re:meeet: нове питання</b>", escapeHtml(f.message)];
  lines.push(f.contact ? `\n<b>Контакт:</b> ${escapeHtml(f.contact)}` : "\n<i>Контакт не вказано</i>");
  if (f.lang) lines.push(`<i>Мова сайту: ${f.lang}</i>`);
  return lines.join("\n");
}

export async function sendFeedback(f: FeedbackInput, cfg: { token: string; chatId: string }): Promise<boolean> {
  const res = await tgCall("sendMessage", { chat_id: cfg.chatId, text: formatFeedback(f), parse_mode: "HTML", link_preview_options: { is_disabled: true } }, cfg.token);
  if (!res.ok) console.warn(`[feedback] telegram send failed: ${res.errorCode ?? ""} ${res.description ?? ""}`);
  return res.ok;
}
