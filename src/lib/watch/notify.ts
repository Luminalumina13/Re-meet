import type { Alert, Watch } from "./types";
import { botToken, escapeHtml, realClient } from "@/lib/telegram/api";
import { alertText, strings } from "@/lib/telegram/text";
import { unlinkChat } from "@/lib/telegram/bot";
import { watchStore } from "./store";
import { postWebhook } from "./webhook";

/** Delivers alerts to the channels configured on a watch. Failures are logged, never thrown. */
export async function notify(watch: Watch, alerts: Alert[]): Promise<void> {
  if (!alerts.length) return;
  const text = alerts.map((a) => `• ${a.message}`).join("\n");
  const title = `Re:meeet · ${watch.label}`;
  const jobs: Promise<unknown>[] = [];

  if (watch.notify.webhookUrl) {
    jobs.push(
      postWebhook(watch.notify.webhookUrl, { text: `${title}
${text}`, watchId: watch.id, label: watch.label, alerts }),
    );
  }
  if (watch.notify.telegramChatId && botToken()) jobs.push(sendTelegram(watch, alerts));

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.warn(`[watch:${watch.id}] notification failed:`, r.reason);
  }
}

async function sendTelegram(watch: Watch, alerts: Alert[]): Promise<void> {
  const chatId = watch.notify.telegramChatId!;
  const lang = watch.notify.telegramLang ?? "uk";
  const body = `<b>${escapeHtml(watch.label)}</b>\n${alerts.map((a) => `• ${escapeHtml(alertText(a, watch, lang))}`).join("\n")}`;
  // Buttons act on the watch through the bot, which only serves chats that linked via the one-time link.
  const s = strings(lang);
  const buttons = watch.notify.telegramVerified
    ? [[{ text: `🔄 ${s.checkNow}`, callback_data: `c:${watch.id}` }, { text: `⏸ ${s.pause}`, callback_data: `p:${watch.id}` }]]
    : undefined;
  const res = await realClient().sendMessage(chatId, body, { buttons });
  // The user blocked the bot or deleted the chat: stop trying instead of failing on every check.
  if (!res.ok && (res.errorCode === 403 || res.errorCode === 400) && /blocked|deactivated|chat not found|kicked/i.test(res.description ?? "")) {
    await unlinkChat(watchStore(), chatId);
  } else if (!res.ok) {
    console.warn(`[watch:${watch.id}] telegram send failed: ${res.errorCode ?? ""} ${res.description ?? ""}`);
  }
}
