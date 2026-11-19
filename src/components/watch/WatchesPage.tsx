"use client";

import Link from "next/link";
import { HowLink } from "@/components/info/HowLink";
import { useCallback, useEffect, useState } from "react";
import { Bell, Pause, Play, RefreshCw, Trash2, TrendingDown, TrendingUp, Sparkles, Target, CircleOff } from "lucide-react";
import type { Alert, Watch } from "@/lib/watch/types";
import { describeWatch } from "@/lib/watch/describe";
import { alertText } from "@/lib/watch/alertText";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { fmtDateTime, fmtMoney, cx } from "@/lib/format";
import { Badge, Button, Card, Skeleton } from "@/components/ui/primitives";
import { Sparkline } from "./Sparkline";
import { TelegramConnect } from "./TelegramConnect";
import { errorText } from "@/lib/errorText";

const ICON: Record<Alert["type"], typeof Bell> = {
  price_drop: TrendingDown,
  price_rise: TrendingUp,
  new_offer: Sparkles,
  target_reached: Target,
  no_results: CircleOff,
};
const TONE: Record<Alert["type"], "good" | "critical" | "accent" | "warn" | "neutral"> = {
  price_drop: "good",
  price_rise: "critical",
  new_offer: "accent",
  target_reached: "good",
  no_results: "warn",
};

export function WatchesPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Watch[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<Watch[]>("/api/watches"));
    } catch (e) {
      setError(errorText(e, t));
    }
  }, [t]);
  useEffect(() => {
    let alive = true;
    api<Watch[]>("/api/watches")
      .then((list) => alive && setItems(list))
      .catch((e) => alive && setError(errorText(e, t)));
    return () => {
      alive = false;
    };
  }, [t]);

  // Returning from Telegram: pick up that the chat got connected.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.watch.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.watch.subtitle}</p>
        <p className="mt-2 text-xs text-ink-3">{t.watch.scheduleHint}</p>
        <HowLink step="watch" className="mt-2" />
      </section>

      {error && <div className="mb-4 rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
      {!items && (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}
      {items && items.length === 0 && (
        <Card className="p-10 text-center text-ink-2">
          <Bell className="mx-auto mb-3 h-8 w-8 text-ink-3" />
          {t.watch.empty}
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Link href="/" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink transition hover:bg-accent-hover">{t.watch.emptyFind}</Link>
            <Link href="/meetup" className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition hover:border-accent">{t.watch.emptyMeetup}</Link>
          </div>
          <div className="mt-3"><HowLink step="watch" label="watchCreate" /></div>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items?.map((w) => {
          const last = w.history[w.history.length - 1];
          const prev = w.history[w.history.length - 2];
          const delta = last && prev ? last.bestPrice - prev.bestPrice : 0;
          return (
            <Card key={w.id} className={cx("rise p-4 sm:p-5 flex flex-col gap-4", !w.active && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={w.params.kind === "search" ? "neutral" : "accent"}>{t.watch.kind[w.params.kind]}</Badge>
                    {!w.active && <Badge tone="warn">{t.watch.paused}</Badge>}
                  </div>
                  <h3 className="mt-1 truncate text-lg font-bold">{w.label}</h3>
                  <p className="truncate text-xs text-ink-3">{describeWatch(w, t.meetup.hours)}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-extrabold tabular-nums tracking-tight">
                    {w.lastBestPrice !== undefined ? fmtMoney({ amount: w.lastBestPrice, currency: w.currency }, locale) : "—"}
                  </div>
                  <div className={cx("text-xs tabular-nums", delta < 0 ? "text-good" : delta > 0 ? "text-critical" : "text-ink-3")}>
                    {delta !== 0 ? `${delta > 0 ? "+" : ""}${fmtMoney({ amount: delta, currency: w.currency }, locale)}` : t.watch.best}
                    {w.targetPrice !== undefined && <span className="text-ink-3"> · 🎯 {fmtMoney({ amount: w.targetPrice, currency: w.currency }, locale)}</span>}
                  </div>
                </div>
              </div>

              <Sparkline points={w.history} currency={w.currency} locale={locale} />

              <div>
                <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.watch.alerts}</div>
                {w.alerts.length === 0 ? (
                  <p className="text-sm text-ink-3">{t.watch.noAlerts}</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {[...w.alerts].reverse().slice(0, 4).map((a) => {
                      const Icon = ICON[a.type];
                      return (
                        <li key={a.id} className="flex items-start gap-2 text-sm">
                          <Badge tone={TONE[a.type]} className="mt-0.5 shrink-0">
                            <Icon className="h-3 w-3" /> {t.watch.alertType[a.type]}
                          </Badge>
                          <span className="min-w-0 truncate text-ink-2">{alertText(a, w, t.watch.alertMsg)}</span>
                          <span className="ml-auto shrink-0 text-xs text-ink-3 tabular-nums">{fmtDateTime(a.at, locale)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-ink-3">
                  {t.watch.lastChecked}: {w.lastCheckedAt ? fmtDateTime(w.lastCheckedAt, locale) : t.watch.never}
                  {w.lastCount !== undefined && ` · ${w.lastCount} ${t.common.results}`}
                </span>
                <TelegramConnect watchId={w.id} connected={Boolean(w.notify.telegramVerified)} onChanged={load} />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" loading={busy === w.id} onClick={() => act(w.id, () => api(`/api/watches/${w.id}/check`, { method: "POST" }))}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t.watch.checkNow}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => act(w.id, () => api(`/api/watches/${w.id}`, { method: "PATCH", body: JSON.stringify({ active: !w.active }) }))}>
                    {w.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />} {w.active ? t.watch.pause : t.watch.resume}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => act(w.id, () => api(`/api/watches/${w.id}`, { method: "DELETE" }))} aria-label={t.common.delete}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
