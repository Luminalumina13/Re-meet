"use client";

import { useMemo } from "react";
import type { Bags, Itinerary } from "@/lib/domain/types";
import { bagsLabel } from "./BagsSelect";
import { bestChains } from "@/lib/multiLeg";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";
import { Card } from "@/components/ui/primitives";
import { LegRow } from "./FlightCard";

/** A trip of several one-way legs (fly in to one airport, home from another, or a chain of cities): the cheapest ways to put them together. */
export function MultiLegResults({ legs, currency, bags }: { legs: Itinerary[][]; currency: string; bags?: Bags }) {
  const { t, locale } = useI18n();
  const chains = useMemo(() => bestChains(legs), [legs]);
  const city = (c: string) => getAirport(c)?.city ?? c;
  if (chains.length === 0) return <Card className="p-8 text-center text-ink-2">{t.multi.none}</Card>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-3">{t.multi.note}</p>
      {chains.map((c, i) => (
        <Card key={c.flights.map((f) => f.id).join("|")} className="rise p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-bold">
              {c.flights.map((f, k) => (
                <span key={k}>
                  {k > 0 && <span className="text-ink-3"> · </span>}
                  {city(f.legs[0].from)} → {city(f.legs[0].to)}
                </span>
              ))}
              {i === 0 && <span className="ml-2 text-xs font-semibold text-good">{t.cheap.best}</span>}
            </h3>
            <span className="text-xl font-extrabold tabular-nums">{fmtMoney({ amount: c.total, currency }, locale)}</span>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {c.flights.map((it, k) => (
              <div key={k} className="rounded-xl border border-border p-3">
                <LegRow leg={it.legs[0]} compact />
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="font-bold tabular-nums">
                    {fmtMoney(it.price, locale)}
                    {bagsLabel(t, bags, it.baggage) && <span className={it.baggage ? "ml-1.5 font-semibold text-good" : "ml-1.5 font-semibold text-warn"}>{bagsLabel(t, bags, it.baggage)}</span>}
                  </span>
                  {it.deepLink && (
                    <a className="font-semibold text-accent-text hover:underline" href={it.deepLink} target="_blank" rel="noreferrer">
                      {t.common.open} → {it.providerName}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
