import type { Alert, Watch } from "./types";

/** Delivers alerts to the channels configured on a watch. Failures are logged, never thrown. */
export async function notify(watch: Watch, alerts: Alert[]): Promise<void> {
  if (!alerts.length) return;
  const text = alerts.map((a) => `• ${a.message}`).join("\n");
  const title = `Re-meet · ${watch.label}`;
  const jobs: Promise<unknown>[] = [];

  if (watch.notify.webhookUrl) {
    jobs.push(
      fetch(watch.notify.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: `${title}\n${text}`, watchId: watch.id, label: watch.label, alerts }),
      }),
    );
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (watch.notify.telegramChatId && token) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: watch.notify.telegramChatId, text: `*${title}*\n${text}`, parse_mode: "Markdown" }),
      }),
    );
  }
  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.warn(`[watch:${watch.id}] notification failed:`, r.reason);
  }
}
