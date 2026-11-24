"use client";

import { useState } from "react";
import { ChevronDown, Clock, Plane, Users, Wallet } from "lucide-react";
import type { Itinerary } from "@/lib/domain/types";
import type { ViaPlan } from "@/lib/meetup/types";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { fmtDurationLocalized, fmtMoney, cx } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import { LegRow } from "@/components/search/FlightCard";
import { SERIES } from "./Timeline";
import { tripDays } from "./PlanCard";

const city = (code: string) => getAirport(code)?.city ?? code;
const hhmm = (local: string) => local.slice(11, 16);

/** "Meet on the way": friends meet at a hub and take one flight together to the destination. */
export function ViaCard({ plan, colorIndex }: { plan: ViaPlan; colorIndex: (id: string) => number }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const leg = plan.shared.legs[0];
  const back = plan.sharedBack?.legs[0];
  const people = plan.friends.length;
  const link = (it: Itinerary | null, arrow: string) =>
    it?.deepLink ? (
      <a key={it.id} className="text-accent-text font-semibold hover:underline" href={it.deepLink} target="_blank" rel="noreferrer">
        {t.common.open} {arrow} {it.providerName}
      </a>
    ) : null;
  return (
    <Card className="rise overflow-hidden">
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="text-xl font-extrabold tracking-tight">
            {city(plan.destination)} <span className="text-ink-3 font-semibold">{plan.destination}</span>
            <span className="block text-sm font-semibold text-ink-2">
              {t.meetup.viaMeet} {city(plan.hub)} ({plan.hub})
            </span>
            {plan.departDate && <span className="block text-sm font-normal tracking-normal text-ink-2">{tripDays(plan.departDate, plan.returnDate, locale)}</span>}
          </h3>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="flex items-center justify-end gap-1.5 text-2xl font-extrabold tabular-nums tracking-tight">
                <Clock className="h-5 w-5 text-accent-text" />
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
                {t.meetup.total} · ≈{fmtMoney({ amount: plan.totalPrice / Math.max(1, people), currency: plan.currency }, locale)} {t.common.perPerson}
              </div>
            </div>
          </div>
        </div>

        <ol className="flex flex-col gap-1.5 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm">
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-good" />
            <span>
              {t.meetup.viaMeet} <b>{city(plan.hub)}</b>, {t.meetup.viaWait} {fmtDurationLocalized(plan.hubWaitMinutes, t.meetup.hours, t.meetup.minutes)}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Plane className="mt-0.5 h-4 w-4 shrink-0 text-good" />
            <span>
              {t.meetup.viaFlyTogether}: {city(leg.from)} {hhmm(leg.departLocal)} → {city(leg.to)} {hhmm(leg.arriveLocal)}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Plane className="mt-0.5 h-4 w-4 shrink-0 rotate-180 text-ink-3" />
            <span>
              {plan.back === "together" && back
                ? `${t.meetup.viaBackTogether.replace("{hub}", city(plan.hub))} (${hhmm(back.departLocal)} → ${hhmm(back.arriveLocal)})`
                : t.meetup.viaBackSeparate}
            </span>
          </li>
        </ol>

        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink-2 hover:text-ink">
          <ChevronDown className={cx("h-4 w-4 transition", open && "rotate-180")} />
          {t.meetup.tickets} ({people})
        </button>

        {open && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {plan.friends.map((f) => {
              const color = SERIES[colorIndex(f.friend.id) % SERIES.length];
              const flights = [f.toHub, plan.shared, plan.sharedBack, f.home].filter((x): x is Itinerary => Boolean(x));
              return (
                <div key={f.friend.id} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      {f.friend.name}
                      {!f.toHub && <span className="text-xs text-ink-3">{t.meetup.viaLivesHere}</span>}
                    </div>
                    <div className="text-sm font-bold tabular-nums">{fmtMoney({ amount: f.price, currency: plan.currency }, locale)}</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {flights.map((it) => (
                      <LegRow key={it.id} leg={it.legs[0]} compact />
                    ))}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{flights.map((it) => link(it, `${it.legs[0].from}→${it.legs[0].to}`))}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
