"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarHeart } from "lucide-react";
import type { SearchFilters } from "@/lib/domain/types";
import type { WeekendShape } from "@/lib/domain/dates";
import { todayIso } from "@/lib/domain/dates";
import type { FlexDayResult } from "@/lib/flex/day";
import { neededDays, rankTrips, weekendTrips, type RankedTrip } from "@/lib/flex/weekends";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { fmtDate, fmtMoney, cx } from "@/lib/format";
import { Button, Card, Chip, Field, Select } from "@/components/ui/primitives";

const CONCURRENCY = 4;
const FIRST = 5;
export const CHEAP_SHAPES: WeekendShape[] = ["sat-sun", "fri-sun", "sat-mon", "fri-mon", "thu-sun"];
export const HORIZONS = [4, 8, 12];

/** The form part: which weekend formats are acceptable and how far ahead to look. */
export function CheapPicker({ shapes, onShapes, weeks, onWeeks }: { shapes: WeekendShape[]; onShapes: (s: WeekendShape[]) => void; weeks: number; onWeeks: (n: number) => void }) {
  const { t } = useI18n();
  const toggle = (s: WeekendShape) => onShapes(shapes.includes(s) ? shapes.filter((x) => x !== s) : CHEAP_SHAPES.filter((x) => x === s || shapes.includes(x)));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">{t.cheap.subtitle}</p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        {/* A div, not a Field: a label around several buttons would forward clicks to the first one. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.cheap.shapes}</span>
          <div className="flex flex-wrap gap-2">
            {CHEAP_SHAPES.map((s) => (
              <Chip key={s} active={shapes.includes(s)} onClick={() => toggle(s)}>
                {t.filters.shape[s]}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t.cheap.horizon}>
          <Select value={weeks} onChange={(e) => onWeeks(Number(e.target.value))} className="w-36">
            {HORIZONS.map((n) => (
              <option key={n} value={n}>
                {n} {t.cheap.weeks}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {shapes.length === 0 && <p className="text-sm text-critical">{t.cheap.noShape}</p>}
    </div>
  );
}

export interface CheapParams {
  origin: string;
  destination: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
}

type Entry = FlexDayResult | "error";

/**
 * Cheapest weekends: prices every day the chosen weekend formats need (one request per day and
 * direction), pairs outbound and return fares and lists the trips cheapest first. Starts when
 * `tick` changes, so the form's search button drives it.
 */
export function CheapestWeekends({
  params,
  shapes,
  weeks,
  filtersFor,
  tick,
  onPick,
}: {
  params: CheapParams;
  shapes: WeekendShape[];
  weeks: number;
  /** Time filters for a given day: the user's own, or the ideal ones for that weekday. */
  filtersFor: (day: string) => SearchFilters;
  tick: number;
  onPick: (trip: RankedTrip) => void;
}) {
  const { t, locale } = useI18n();
  const [done, setDone] = useState(0);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [ran, setRan] = useState<{ tick: number; trips: ReturnType<typeof weekendTrips> } | null>(null);
  const [visible, setVisible] = useState(FIRST);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef({ params, shapes, weeks, filtersFor });
  useEffect(() => {
    latest.current = { params, shapes, weeks, filtersFor };
  });

  const load = useCallback(async (runTick: number) => {
    const { params: p, shapes: sh, weeks: wk, filtersFor: ff } = latest.current;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const trips = weekendTrips(todayIso(), wk, sh);
    const days = neededDays(trips);
    const jobs = [...days.out.map((d) => ({ d, dir: "outbound" as const })), ...days.back.map((d) => ({ d, dir: "inbound" as const }))];
    setRan({ tick: runTick, trips });
    setEntries({});
    setDone(0);
    setVisible(FIRST);
    const base = { adults: p.adults, children: p.children, infants: p.infants, cabin: p.cabin, currency: p.currency };
    let next = 0;
    const worker = async () => {
      while (next < jobs.length && !ctl.signal.aborted) {
        const { d, dir } = jobs[next++];
        const [origin, destination] = dir === "outbound" ? [p.origin, p.destination] : [p.destination, p.origin];
        let entry: Entry;
        try {
          entry = await postJson<FlexDayResult>("/api/flex", { ...base, origin, destination, date: d, direction: dir, filters: ff(d) });
        } catch {
          entry = "error";
        }
        if (ctl.signal.aborted) return;
        setEntries((e) => ({ ...e, [`${dir}:${d}`]: entry }));
        setDone((n) => n + 1);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }, []);

  useEffect(() => {
    if (tick > 0 && shapes.length > 0) void load(tick);
    // Only the search button (tick) starts a run; later edits to the form do not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  useEffect(() => () => abort.current?.abort(), []);

  const jobsTotal = useMemo(() => {
    if (!ran) return 0;
    const d = neededDays(ran.trips);
    return d.out.length + d.back.length;
  }, [ran]);
  const pending = ran !== null && done < jobsTotal;
  const failed = Object.values(entries).some((e) => e === "error" || e.partial);

  const ranked = useMemo(() => {
    if (!ran) return [];
    const days = neededDays(ran.trips);
    const optionsOf = (dir: "outbound" | "inbound", d: string) => {
      const e = entries[`${dir}:${d}`];
      return e && e !== "error" ? e.options : [];
    };
    return rankTrips(ran.trips, new Map(days.out.map((d) => [d, optionsOf("outbound", d)] as const)), new Map(days.back.map((d) => [d, optionsOf("inbound", d)] as const)));
  }, [ran, entries]);

  if (!ran) return null;
  const money = (n: number) => fmtMoney({ amount: n, currency: params.currency }, locale);
  const dm = (d: string) => fmtDate(d, locale, { weekday: "short", day: "numeric", month: "short" });
  const best = ranked[0]?.price ?? 0;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <CalendarHeart className="h-4 w-4 text-accent-text" /> {t.cheap.title}
        </h3>
        {pending && (
          <p className="text-xs text-ink-3">
            {t.cheap.progress}: {done} / {jobsTotal}
          </p>
        )}
      </div>

      {ranked.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {ranked.slice(0, visible).map((r, i) => (
            <li key={`${r.departDate}|${r.returnDate}`}>
              <button
                type="button"
                onClick={() => onPick(r)}
                title={t.cheap.pick}
                className={cx(
                  "flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-left transition hover:border-accent hover:bg-surface-2",
                  i === 0 && !pending ? "border-good/60 bg-good/10" : "border-border",
                )}
              >
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {dm(r.departDate)} <span className="text-ink-3">→</span> {dm(r.returnDate)}
                  </span>
                  <span className="text-xs text-ink-3">
                    {t.filters.shape[r.shape]}
                    {i === 0 && !pending ? ` · ${t.cheap.best}` : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  {i > 0 && <span className="text-xs text-ink-3">+{money(r.price - best)}</span>}
                  <span className="text-lg font-extrabold tabular-nums">{money(r.price)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      {ranked.length > visible && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => setVisible((v) => v + 10)}>
          {t.cheap.more} ({ranked.length - visible})
        </Button>
      )}

      {!pending && ranked.length === 0 && <p className="mt-3 text-sm text-ink-2">{t.cheap.empty}</p>}
      {!pending && failed && <p className="mt-3 text-xs text-warn">{t.cheap.partial}</p>}
      <p className="mt-3 text-xs text-ink-3">{t.cheap.noteRound}</p>
    </Card>
  );
}
