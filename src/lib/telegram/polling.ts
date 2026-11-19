import { watchStore } from "@/lib/watch/store";
import { checkWatch } from "@/lib/watch/checker";
import { botToken, realClient, setupCommands, tgCall } from "./api";
import { handleUpdate, type TgUpdate } from "./bot";
import { ALLOWED_UPDATES } from "./api";

/** Dependencies wired to the real store and checker. */
export function liveDeps() {
  return { client: realClient(), store: watchStore(), check: (id: string) => checkWatch(id), appUrl: process.env.APP_URL };
}

/**
 * Long polling for local development, where Telegram cannot reach a webhook.
 * Enabled with TELEGRAM_MODE=polling. Do not run it next to a webhook: Telegram allows only one.
 */

/**
 * Polling has to delete the bot's webhook, which would silence a production bot that shares the token. So it only starts when
 * the bot has no webhook, unless TELEGRAM_POLLING_TAKEOVER=1 says that taking the bot over is intended.
 */
export async function mayTakeOverBot(token = botToken()): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (process.env.TELEGRAM_POLLING_TAKEOVER === "1") return { ok: true };
  const info = await tgCall<{ url?: string }>("getWebhookInfo", {}, token);
  if (!info.ok) return { ok: false, reason: "could not check whether the bot has a webhook" };
  const url = info.result?.url;
  if (url) return { ok: false, reason: `this bot has a webhook (${new URL(url).host}); long polling would delete it and silence that deployment` };
  return { ok: true };
}

export async function startPolling(): Promise<void> {
  const token = botToken();
  if (!token) return;
  const guard = await mayTakeOverBot(token);
  if (!guard.ok) {
    console.warn(`[telegram] long polling NOT started: ${guard.reason}. Use a separate bot for development, or set TELEGRAM_POLLING_TAKEOVER=1.`);
    return;
  }
  await tgCall("deleteWebhook", {});
  await setupCommands();
  console.log("[telegram] long polling started");
  let offset = 0;
  let failures = 0;
  for (;;) {
    const res = await tgCall<TgUpdate[]>("getUpdates", { offset, timeout: 30, allowed_updates: ALLOWED_UPDATES }, token, 45_000);
    if (!res.ok) {
      failures++;
      // A 409 means a webhook or another poller owns the bot; back off instead of spinning.
      await new Promise((r) => setTimeout(r, Math.min(60_000, 1000 * 2 ** Math.min(failures, 6))));
      continue;
    }
    failures = 0;
    for (const u of res.result ?? []) {
      offset = Math.max(offset, (u.update_id ?? 0) + 1);
      // Do not await: a slow "check now" must not hold up other users.
      void handleUpdate(u, liveDeps());
    }
  }
}
