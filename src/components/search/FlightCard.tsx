"use client";

import { ArrowRight, Bell, ExternalLink } from "lucide-react";
import type { Leg, ScoredItinerary } from "@/lib/domain/types";
import { getAirport } from "@/lib/data/airports";
import { localTime, localDate } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtDurationLocalized, fmtMoney, cx } from "@/lib/format";
import { Badge, Button } from "@/components/ui/primitives";

export function LegRow({ leg, compact }: { leg: Leg; compact?: boolean }) {
  const { t, locale } = useI18n();
  const carriers = [...new Set(leg.segments.map((s) => s.carrierName ?? s.carrier))].join(", ");
  const nums = leg.segments.map((s) => `${s.carrier}${s.flightNumber}`).join(" · ");
  const nextDay = localDate(leg.arriveLocal) !== localDate(leg.departLocal);
  return (
    <div className={cx("grid items-center gap-3", compact ? "grid-cols-[auto_1fr_auto]" : "grid-cols-[72px_1fr_72px] sm:grid-cols-[88px_1fr_88px]")}>
      <div>
        <div className="text-xl font-bold tabular-nums leading-none">{localTime(leg.departLocal)}</div>
        <div className="mt-1 text-xs text-ink-3">
          <span className="font-semibold text-ink-2">{leg.from}</span> · {fmtDate(leg.departLocal, locale, { day: "numeric", month: "short" })}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-ink-3">
          <span className="h-px flex-1 bg-border-strong" />
          <span className="whitespace-nowrap">
            {fmtDurationLocalized(leg.durationMin, t.meetup.hours, t.meetup.minutes)} ·{" "}
            {leg.stops === 0 ? t.common.direct : `${leg.stops} ${leg.stops === 1 ? t.common.stop : t.common.stops}${leg.stops ? ` (${leg.segments.slice(0, -1).map((s) => s.to).join(", ")})` : ""}`}
          </span>
          <span className="h-px flex-1 bg-border-strong" />
        </div>
        <div className="mt-1 truncate text-center text-xs text-ink-2">
          {carriers} <span className="text-ink-3">{nums}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-xl font-bold tabular-nums leading-none">
          {localTime(leg.arriveLocal)}
          {nextDay && <sup className="ml-0.5 text-[10px] text-warn">+1</sup>}
        </div>
        <div className="mt-1 text-xs text-ink-3">
          <span className="font-semibold text-ink-2">{leg.to}</span> · {getAirport(leg.to)?.city ?? ""}
        </div>
      </div>
    </div>
  );
}

export function FlightCard({ it, onTrack, adults = 1 }: { it: ScoredItinerary; onTrack?: (it: ScoredItinerary) => void; adults?: number }) {
  const { t, locale } = useI18n();
  return (
    <article className="rise rounded-[var(--radius)] border border-border bg-surface shadow-card transition hover:border-border-strong">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:p-5">
        <div className="flex flex-col gap-4">
          {it.legs.map((leg, i) => (
            <LegRow key={i} leg={leg} />
          ))}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={it.comfort >= 80 ? "good" : it.comfort >= 55 ? "accent" : "neutral"} className="tabular-nums">
              {t.badges.comfort} {it.comfort}
            </Badge>
            {it.badges.map((b) => (
              <Badge key={b}>{t.badges[b as keyof typeof t.badges] ?? b}</Badge>
            ))}
            {it.seatsLeft !== undefined && it.seatsLeft <= 3 && (
              <Badge tone="warn">
                {it.seatsLeft} {t.common.seatsLeft}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-row items-center justify-between gap-3 border-t border-border pt-4 sm:flex-col sm:items-end sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:min-w-[160px]">
          <div className="text-right">
            <div className="text-2xl font-extrabold tabular-nums tracking-tight">{fmtMoney(it.price, locale)}</div>
            <div className="text-xs text-ink-3">
              {adults > 1 ? `${fmtMoney({ amount: it.price.amount / adults, currency: it.price.currency }, locale)} ${t.common.perPerson} · ` : ""}
              {it.providerName}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onTrack && (
              <Button size="sm" variant="ghost" onClick={() => onTrack(it)} title={t.common.track}>
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">{t.common.track}</span>
              </Button>
            )}
            {it.deepLink ? (
              <a href={it.deepLink} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-ink hover:bg-accent-strong">
                {t.common.open} <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="inline-flex h-8 items-center gap-1 rounded-lg bg-surface-2 px-3 text-[13px] font-semibold text-ink-2">
                {it.providerName} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
