"use client";

import { useState } from "react";
import { Bell, ChevronDown, Clock, Wallet } from "lucide-react";
import type { MeetupPlan } from "@/lib/meetup/types";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { fmtDurationLocalized, fmtMoney, cx } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { LegRow } from "@/components/search/FlightCard";
import { Timeline, SERIES } from "./Timeline";

export function PlanCard({
  plan,
  rank,
  departDate,
  returnDate,
  colorIndex,
  onTrack,
  highlight,
}: {
  plan: MeetupPlan;
  rank: number;
  departDate: string;
  returnDate: string;
  colorIndex: (id: string) => number;
  onTrack?: () => void;
  highlight?: boolean;
}) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(highlight ?? false);
  const dest = getAirport(plan.destination);
  const travellers = plan.friends.filter((f) => f.outbound).length;
  return (
    <Card className={cx("rise overflow-hidden", highlight && "ring-2 ring-accent/50")}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {highlight && <Badge tone="accent">{t.meetup.bestPlan}</Badge>}
              <span className="text-xs text-ink-3">#{rank}</span>
            </div>
            <h3 className="mt-1 text-xl font-extrabold tracking-tight">
              {dest?.city ?? plan.destination} <span className="text-ink-3 font-semibold">{plan.destination}</span>
            </h3>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-2xl font-extrabold tabular-nums tracking-tight">
                <Clock className="h-5 w-5 text-accent" />
                {fmtDurationLocalized(plan.togetherMinutes, t.meetup.hours, t.meetup.minutes)}
              </div>
              <div className="text-xs text-ink-3">{t.meetup.together}</div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-2xl font-extrabold tabular-nums tracking-tight">
                <Wallet className="h-5 w-5 text-ink-3" />
                {fmtMoney({ amount: plan.totalPrice, currency: plan.currency }, locale)}
              </div>
              <div className="text-xs text-ink-3">
                {t.meetup.total} · ≈{fmtMoney({ amount: plan.totalPrice / Math.max(1, travellers), currency: plan.currency }, locale)} {t.common.perPerson}
              </div>
            </div>
          </div>
        </div>

        <Timeline plan={plan} departDate={departDate} returnDate={returnDate} colorIndex={colorIndex} />

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
            <ChevronDown className={cx("h-4 w-4 transition", open && "rotate-180")} />
            {t.meetup.tickets} ({travellers})
          </button>
          {onTrack && (
            <Button size="sm" variant="ghost" onClick={onTrack}>
              <Bell className="h-4 w-4" /> {t.meetup.trackPlan}
            </Button>
          )}
        </div>

        {open && (
          <div className="grid gap-3 lg:grid-cols-2">
            {plan.friends.map((f) => {
              const color = SERIES[colorIndex(f.friend.id) % SERIES.length];
              return (
                <div key={f.friend.id} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {f.friend.name} <span className="text-xs text-ink-3">{getAirport(f.friend.origin)?.city ?? f.friend.origin}</span>
                    </div>
                    <div className="text-sm font-bold tabular-nums">{f.outbound ? fmtMoney({ amount: f.price, currency: plan.currency }, locale) : t.meetup.host}</div>
                  </div>
                  {f.outbound && f.inbound ? (
                    <div className="flex flex-col gap-3">
                      <LegRow leg={f.outbound.legs[0]} compact />
                      <LegRow leg={f.inbound.legs[0]} compact />
                      <div className="flex gap-2 text-xs">
                        {f.outbound.deepLink && (
                          <a className="text-accent font-semibold hover:underline" href={f.outbound.deepLink} target="_blank" rel="noreferrer">
                            {t.common.open} → {f.outbound.providerName}
                          </a>
                        )}
                        {f.inbound.deepLink && (
                          <a className="text-accent font-semibold hover:underline" href={f.inbound.deepLink} target="_blank" rel="noreferrer">
                            {t.common.open} ← {f.inbound.providerName}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-3">{t.meetup.host}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
