"use client";

import { useState } from "react";
import type { MeetupPlan } from "@/lib/meetup/types";
import { airportTz, getAirport } from "@/lib/data/airports";
import { localToUtc, utcToLocal, addDays } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n";
import { fmtDate, cx } from "@/lib/format";

function fmtLocal(localIso: string, locale: string): string {
  return `${fmtDate(localIso, locale, { weekday: "short", day: "numeric", month: "short" })}, ${localIso.slice(11, 16)}`;
}

export const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)", "var(--series-6)"];

/**
 * Gantt-style view: one row per friend, bar = time present in the destination,
 * shaded band = window when everyone is together. Axis is destination local time.
 */
export function Timeline({ plan, departDate, returnDate, colorIndex }: { plan: MeetupPlan; departDate: string; returnDate: string; colorIndex: (friendId: string) => number }) {
  const { t, locale } = useI18n();
  const tz = airportTz(plan.destination);
  const start = Date.parse(localToUtc(`${departDate}T00:00`, tz));
  const end = Date.parse(localToUtc(`${addDays(returnDate, 1)}T00:00`, tz));
  const span = end - start;
  const x = (utc: string | number) => Math.min(100, Math.max(0, ((typeof utc === "number" ? utc : Date.parse(utc)) - start) / span * 100));
  const [hover, setHover] = useState<string | null>(null);

  const days: string[] = [];
  for (let d = departDate; d <= returnDate; d = addDays(d, 1)) days.push(d);
  const meetL = x(plan.meetStartUtc);
  const meetR = x(plan.meetEndUtc);

  return (
    <div className="flex flex-col gap-1.5 select-none">
      <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] gap-3">
        <div />
        <div className="relative h-5 text-[11px] text-ink-3">
          {days.map((d, i) => (
            <span key={d} className="absolute top-0 -translate-x-0 whitespace-nowrap" style={{ left: `${(i / days.length) * 100}%` }}>
              {fmtDate(d, locale, { weekday: "short", day: "numeric" })}
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] gap-3">
        <div className="flex flex-col gap-2 py-1">
          {plan.friends.map((f) => (
            <div key={f.friend.id} className="flex h-8 items-center gap-2 text-sm font-semibold truncate">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SERIES[colorIndex(f.friend.id) % SERIES.length] }} />
              <span className="truncate">{f.friend.name}</span>
            </div>
          ))}
        </div>
        <div className="relative rounded-xl border border-border bg-surface-2/60 overflow-hidden">
          {days.map((d, i) => (
            <div key={d} className="absolute inset-y-0 border-l border-border/80 first:border-0" style={{ left: `${(i / days.length) * 100}%` }} />
          ))}
          {/* together band */}
          <div className="absolute inset-y-0 bg-accent/12 border-x-2 border-accent/60" style={{ left: `${meetL}%`, width: `${Math.max(0.3, meetR - meetL)}%` }} title={t.meetup.meetWindow} />
          <div className="relative flex flex-col gap-2 py-1">
            {plan.friends.map((f) => {
              const color = SERIES[colorIndex(f.friend.id) % SERIES.length];
              const host = !f.outbound;
              const l = host ? 0 : x(f.arriveUtc!);
              const r = host ? 100 : x(f.departUtc!);
              const arrive = host ? "" : utcToLocal(f.arriveUtc!, tz).slice(11);
              const leave = host ? "" : utcToLocal(f.departUtc!, tz).slice(11);
              const id = f.friend.id;
              return (
                <div key={id} className="relative h-8" onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(null)}>
                  <div
                    className={cx("absolute top-1 h-6 rounded-md transition-opacity flex items-center justify-between px-1.5 text-[11px] font-semibold text-white", hover && hover !== id && "opacity-50")}
                    style={{ left: `${l}%`, width: `${Math.max(1.5, r - l)}%`, background: color, opacity: host ? 0.45 : undefined }}
                  >
                    {host ? (
                      <span className="text-ink">{t.meetup.host}</span>
                    ) : (
                      <>
                        <span className="tabular-nums drop-shadow">{arrive}</span>
                        <span className="tabular-nums drop-shadow">{leave}</span>
                      </>
                    )}
                  </div>
                  {hover === id && !host && (
                    <div className="absolute -top-9 z-10 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] shadow-card whitespace-nowrap" style={{ left: `${Math.min(l, 70)}%` }}>
                      {f.friend.name}: {t.meetup.arrives} {arrive} · {t.meetup.leaves} {leave} · {f.outbound!.legs[0].from}→{f.outbound!.legs[0].to}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[88px_1fr] sm:grid-cols-[120px_1fr] gap-3 text-[11px] text-ink-3">
        <div />
        <div>
          {t.meetup.meetWindow} ({getAirport(plan.destination)?.city ?? plan.destination}): {fmtLocal(plan.meetStartLocal, locale)} – {fmtLocal(plan.meetEndLocal, locale)}
        </div>
      </div>
    </div>
  );
}
