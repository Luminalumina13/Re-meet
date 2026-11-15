"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import type { SearchFilters } from "@/lib/domain/types";
import type { FlexDayResult } from "@/lib/flex/day";
import { flexDates, flexGrid, priceRank } from "@/lib/flex/matrix";
import { todayIso } from "@/lib/domain/dates";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { fmtMoney, cx } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";

const DAYS = 3;
const CONCURRENCY = 4;

export interface FlexParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
  filters: SearchFilters;
}

type Entry = FlexDayResult | "error";

/**
 * Flexible dates: cheapest fares for ±3 days around the chosen dates. One request per day and
 * direction, filled in as the answers arrive. Round-trip cells are sums of one-way fares.
 */
export function FlexDates({ params, onPick }: { params: FlexParams; onPick: (depart: string, ret?: string) => void }) {
  const { t, locale } = useI18n();
  const [started, setStarted] = useState<string | null>(null);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const abort = useRef<AbortController | null>(null);

  // Everything that changes the answers; a different key means the grid on screen is stale.
  const key = useMemo(() => JSON.stringify(params), [params]);
  const today = todayIso();
  const departDays = useMemo(() => flexDates(params.departDate, DAYS, today), [params.departDate, today]);
  const returnDays = useMemo(() => (params.returnDate ? flexDates(params.returnDate, DAYS, today) : []), [params.returnDate, today]);
  const roundTrip = Boolean(params.returnDate);

  const load = useCallback(async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setStarted(key);
    setEntries({});
    const jobs = [...departDays.map((d) => ({ d, dir: "outbound" as const })), ...returnDays.map((d) => ({ d, dir: "inbound" as const }))];
    const base = { adults: params.adults, children: params.children, infants: params.infants, cabin: params.cabin, currency: params.currency, filters: params.filters };
    let next = 0;
    const worker = async () => {
      while (next < jobs.length && !ctl.signal.aborted) {
        const { d, dir } = jobs[next++];
        const [origin, destination] = dir === "outbound" ? [params.origin, params.destination] : [params.destination, params.origin];
        let entry: Entry;
        try {
          entry = await postJson<FlexDayResult>("/api/flex", { ...base, origin, destination, date: d, direction: dir });
        } catch {
          entry = "error";
        }
        if (!ctl.signal.aborted) setEntries((e) => ({ ...e, [`${dir}:${d}`]: entry }));
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }, [key, params, departDays, returnDays]);

  useEffect(() => () => abort.current?.abort(), []);

  const fresh = started === key;
  const price = (dir: "outbound" | "inbound", d: string): number | null | undefined => {
    const e = fresh ? entries[`${dir}:${d}`] : undefined;
    if (e === undefined) return undefined; // not loaded yet
    return e === "error" ? null : e.price;
  };
  const pending = fresh && [...departDays.map((d) => `outbound:${d}`), ...returnDays.map((d) => `inbound:${d}`)].some((k) => entries[k] === undefined);

  const grid = useMemo(() => {
    if (!roundTrip) return [];
    const optionsOf = (dir: "outbound" | "inbound", d: string) => {
      const e = fresh ? entries[`${dir}:${d}`] : undefined;
      return e && e !== "error" ? e.options : [];
    };
    return flexGrid(new Map(departDays.map((d) => [d, optionsOf("outbound", d)] as const)), new Map(returnDays.map((d) => [d, optionsOf("inbound", d)] as const)));
  }, [entries, fresh, roundTrip, departDays, returnDays]);

  const oneWay = useMemo(() => (roundTrip ? [] : departDays.map((d) => ({ depart: d, ret: d, price: price("outbound", d) })).filter((c): c is { depart: string; ret: string; price: number } => typeof c.price === "number")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, fresh, roundTrip, departDays]);

  const cells = roundTrip ? grid : oneWay;
  const min = cells.length ? Math.min(...cells.map((c) => c.price)) : 0;
  const max = cells.length ? Math.max(...cells.map((c) => c.price)) : 0;
  const best = cells.find((c) => c.price === min);
  const money = (n: number) => fmtMoney({ amount: n, currency: params.currency }, locale);
  const day = (d: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "numeric" }).format(new Date(`${d}T12:00:00`));
  const cellOf = (depart: string, ret: string) => grid.find((c) => c.depart === depart && c.ret === ret);
  const shade = (p: number) => ({ background: `color-mix(in srgb, var(--good) ${Math.round((1 - priceRank(p, min, max)) * 38)}%, transparent)` });

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold">
            <CalendarRange className="h-4 w-4 text-accent-text" /> {t.flex.title}
          </h3>
          <p className="mt-0.5 text-xs text-ink-3">{t.flex.subtitle}</p>
        </div>
        <Button variant="secondary" size="sm" loading={pending} onClick={load}>
          {fresh ? t.flex.refresh : t.flex.show}
        </Button>
      </div>

      {fresh && (
        <div className="mt-4 flex flex-col gap-3">
          {best && (
            <button
              type="button"
              onClick={() => onPick(best.depart, roundTrip ? best.ret : undefined)}
              className="self-start rounded-xl bg-good/15 px-3 py-2 text-left text-sm hover:bg-good/25"
            >
              <span className="font-semibold">{t.flex.cheapest}: {money(best.price)}</span>
              <span className="text-ink-2"> · {day(best.depart)}{roundTrip ? ` → ${day(best.ret)}` : ""}</span>
            </button>
          )}

          <div className="overflow-x-auto">
            {roundTrip ? (
              <table className="w-full min-w-[560px] border-separate border-spacing-1 text-center text-sm">
                <thead>
                  <tr>
                    <th className="p-1 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.flex.corner}</th>
                    {returnDays.map((r) => (
                      <th key={r} className={cx("p-1 text-xs font-semibold", r === params.returnDate ? "text-accent-text" : "text-ink-2")}>
                        {day(r)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {departDays.map((d) => (
                    <tr key={d}>
                      <th className={cx("whitespace-nowrap p-1 text-left text-xs font-semibold", d === params.departDate ? "text-accent-text" : "text-ink-2")}>{day(d)}</th>
                      {returnDays.map((r) => {
                        const c = cellOf(d, r);
                        const loading = price("outbound", d) === undefined || price("inbound", r) === undefined;
                        const current = d === params.departDate && r === params.returnDate;
                        return (
                          <td key={r} className="p-0">
                            {r < d ? (
                              <div className="h-10 rounded-lg" />
                            ) : c ? (
                              <button
                                type="button"
                                onClick={() => onPick(d, r)}
                                style={shade(c.price)}
                                className={cx("h-10 w-full rounded-lg tabular-nums transition hover:ring-2 hover:ring-accent", c.price === min && "font-extrabold ring-2 ring-good", current && c.price !== min && "ring-2 ring-accent")}
                              >
                                {money(c.price)}
                              </button>
                            ) : (
                              <div className="flex h-10 items-center justify-center rounded-lg bg-surface-2 text-ink-3">{loading ? "…" : "—"}</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex min-w-[560px] gap-1">
                {departDays.map((d) => {
                  const p = price("outbound", d);
                  const c = oneWay.find((x) => x.depart === d);
                  return (
                    <div key={d} className="flex flex-1 flex-col items-center gap-1">
                      <span className={cx("text-xs font-semibold", d === params.departDate ? "text-accent-text" : "text-ink-2")}>{day(d)}</span>
                      {c ? (
                        <button
                          type="button"
                          onClick={() => onPick(d)}
                          style={shade(c.price)}
                          className={cx("h-10 w-full rounded-lg text-sm tabular-nums hover:ring-2 hover:ring-accent", c.price === min && "font-extrabold ring-2 ring-good", d === params.departDate && c.price !== min && "ring-2 ring-accent")}
                        >
                          {money(c.price)}
                        </button>
                      ) : (
                        <div className="flex h-10 w-full items-center justify-center rounded-lg bg-surface-2 text-ink-3">{p === undefined ? "…" : "—"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-xs text-ink-3">{roundTrip ? t.flex.noteRound : t.flex.noteOne}</p>
          {!pending && cells.length === 0 && <p className="text-sm text-ink-2">{t.flex.empty}</p>}
        </div>
      )}
    </Card>
  );
}
