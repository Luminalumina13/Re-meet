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
export async function startPolling(): Promise<void> {
  const token = botToken();
  if (!token) return;
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
