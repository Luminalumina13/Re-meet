"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import type { SearchFilters } from "@/lib/domain/types";
import { datePairs, rangeDays, type DateRange } from "@/lib/domain/dateRange";
import { diffDays } from "@/lib/domain/time";
import { flexGrid, type FlexCell } from "@/lib/flex/matrix";
import { dayKey, loadDays, type DayEntry } from "@/lib/flex/loadDays";
import { useI18n } from "@/lib/i18n";
import { cx, fmtMoney } from "@/lib/format";
import { Button, Card } from "@/components/ui/primitives";

export interface RangeParams {
  origin: string;
  destination: string;
  adults: number;
  children: number;
  infants: number;
  cabin: string;
  currency: string;
  filters: SearchFilters;
  range: DateRange;
}

const PAGE = 8;

/**
 * Date range on the search page: the cheapest one-way fare for every day of both windows, then
 * every fitting departure/return pair ranked by the sum. `run` changes on each search to reload.
 */
export function RangeResults({ params, run, onPick }: { params: RangeParams; run: number; onPick: (depart: string, ret?: string) => void }) {
  const { t, locale } = useI18n();
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [shown, setShown] = useState(PAGE);
  // What the last search asked for; editing the form afterwards does not change the list on screen.
  const [ran, setRan] = useState<{ range: DateRange; outDays: string[]; backDays: string[]; pairs: [string, string][] } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  });

  const load = useCallback(async () => {
    const p = latest.current;
    const range = p.range;
    const pairs = datePairs(range);
    const outDays = range.returnDate ? [...new Set(pairs.map((x) => x[0]))] : rangeDays(range.departDate, range.departUntil);
    const backDays = [...new Set(pairs.map((x) => x[1]))].sort();
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setRan({ range, outDays, backDays, pairs });
    setEntries({});
    setShown(PAGE);
    const jobs = [...outDays.map((date) => ({ date, dir: "outbound" as const })), ...backDays.map((date) => ({ date, dir: "inbound" as const }))];
    await loadDays(jobs, p, ctl.signal, (k, entry) => setEntries((e) => ({ ...e, [k]: entry })));
  }, []);

  useEffect(() => {
    if (run > 0) void load();
    // Only a new search (run) starts loading; later edits to the form do not.
  }, [run, load]);
  useEffect(() => () => abort.current?.abort(), []);

  const roundTrip = Boolean(ran?.range.returnDate);
  const outDays = useMemo(() => ran?.outDays ?? [], [ran]);
  const backDays = useMemo(() => ran?.backDays ?? [], [ran]);
  const pairs = useMemo(() => ran?.pairs ?? [], [ran]);
  const total = outDays.length + backDays.length;
  const done = Object.keys(entries).length;
  const pending = done < total;

  const cells = useMemo<FlexCell[]>(() => {
    const optionsOf = (dir: "outbound" | "inbound", d: string) => {
      const e = entries[dayKey(dir, d)];
      return e && e !== "error" ? e.options : [];
    };
    if (!roundTrip) {
      return outDays.flatMap((d) => {
        const e = entries[dayKey("outbound", d)];
        return e && e !== "error" && e.price !== null ? [{ depart: d, ret: d, price: e.price }] : [];
      });
    }
    const fits = new Set(pairs.map(([d, r]) => `${d}|${r}`));
    return flexGrid(new Map(outDays.map((d) => [d, optionsOf("outbound", d)] as const)), new Map(backDays.map((d) => [d, optionsOf("inbound", d)] as const))).filter((c) => fits.has(`${c.depart}|${c.ret}`));
  }, [entries, roundTrip, outDays, backDays, pairs]);

  const sorted = useMemo(() => [...cells].sort((a, b) => a.price - b.price || a.depart.localeCompare(b.depart)), [cells]);
  if (!ran) return null;
  const min = sorted[0]?.price;
  const money = (n: number) => fmtMoney({ amount: n, currency: params.currency }, locale);
  const day = (d: string) => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T12:00:00`));

  return (
    <Card className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-base font-bold">
        <CalendarRange className="h-4 w-4 text-accent-text" /> {t.range.title}
      </h3>
      <p className="mt-0.5 text-xs text-ink-3">{roundTrip ? t.range.subtitle : t.range.subtitleOne}</p>
      {pending && <p className="mt-2 text-xs font-semibold text-ink-2" aria-live="polite">{t.range.progress.replace("{done}", String(done)).replace("{total}", String(total))}</p>}
      {pending && total > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      )}
      <ul className="mt-3 flex flex-col gap-1.5">
        {sorted.slice(0, shown).map((c) => (
          <li key={`${c.depart}|${c.ret}`}>
            <button
              type="button"
              onClick={() => onPick(c.depart, roundTrip ? c.ret : undefined)}
              className={cx("flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition hover:border-accent hover:bg-accent-soft/40", c.price === min && "border-good bg-good/10")}
            >
              <span className="min-w-0">
                <span className="font-semibold">{day(c.depart)}</span>
                {roundTrip && (
                  <>
                    <span className="text-ink-3"> → </span>
                    <span className="font-semibold">{day(c.ret)}</span>
                    <span className="ml-2 whitespace-nowrap text-xs text-ink-3">
                      {diffDays(c.depart, c.ret)} {t.range.nights}
                    </span>
                  </>
                )}
              </span>
              <span className={cx("shrink-0 tabular-nums", c.price === min ? "font-extrabold text-good" : "font-semibold")}>{money(c.price)}</span>
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > shown && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShown((n) => n + PAGE)}>
          {t.range.more}
        </Button>
      )}
      {roundTrip && <p className="mt-3 text-xs text-ink-3">{t.flex.noteRound}</p>}
      {!pending && sorted.length === 0 && <p className="mt-3 text-sm text-ink-2">{t.range.empty2}</p>}
    </Card>
  );
}
