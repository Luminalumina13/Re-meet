/**
 * Optional in-process scheduler for price tracking.
 * Set WATCH_POLL_MINUTES=30 to re-check saved watches every 30 minutes without an external cron.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Telegram bot via long polling (local development; production uses the webhook route).
  if (process.env.TELEGRAM_MODE === "polling" && process.env.TELEGRAM_BOT_TOKEN) {
    const g = globalThis as { __telegramPolling?: boolean };
    if (!g.__telegramPolling) {
      g.__telegramPolling = true;
      const { startPolling } = await import("@/lib/telegram/polling");
      void startPolling().catch((e) => console.warn("[telegram] polling stopped", e));
    }
  }
  const every = Number(process.env.WATCH_POLL_MINUTES ?? 0);
  if (!every || Number.isNaN(every)) return;
  const { checkDue } = await import("@/lib/watch/checker");
  const tick = async () => {
    try {
      const r = await checkDue(every * 0.9);
      if (r.checked) console.log(`[watch] checked ${r.checked} watch(es), ${r.alerts} alert(s)`);
    } catch (e) {
      console.warn("[watch] scheduler tick failed", e);
      const { reportError } = await import("@/lib/errorReport");
      void reportError("scheduler", e);
    }
  };
  setTimeout(tick, 15_000);
  setInterval(tick, every * 60_000).unref();
  console.log(`[watch] in-process scheduler enabled: every ${every} min`);
}
