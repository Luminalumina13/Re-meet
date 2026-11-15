"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowLeftRight, Search, SlidersHorizontal } from "lucide-react";
import type { SearchFilters, SearchResponse, ScoredItinerary } from "@/lib/domain/types";
import { IDEAL_WEEKEND_FILTERS, sortItineraries, type SortKey } from "@/lib/domain/filters";
import { todayIso, nextSaturday, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import type { SearchRequestInput } from "@/lib/api/schemas";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { Button, Card, Field, Input, Segmented, Select, Skeleton, Stepper } from "@/components/ui/primitives";
import { WeekendPicker } from "./WeekendPicker";
import { TimeWindows } from "./TimeWindows";
import { FlightCard } from "./FlightCard";
import { ProviderBar } from "./ProviderBar";
import { AirlineFilter, filterByCarriers } from "./AirlineFilter";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { cx } from "@/lib/format";

type Mode = "weekend" | "custom";
const PAGE = 15;

export function SearchPage() {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("WAW");
  const [destination, setDestination] = useState("BCN");
  const [mode, setMode] = useState<Mode>("weekend");
  const [saturday, setSaturday] = useState(() => nextSaturday(todayIso()));
  const [shape, setShape] = useState<WeekendShape>("sat-sun");
  const [departDate, setDepartDate] = useState(() => nextSaturday(todayIso()));
  const [returnDate, setReturnDate] = useState<string>(() => weekendFromSaturday(nextSaturday(todayIso()), "sat-sun").returnDate);
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<SearchRequestInput["cabin"]>("economy");
  const [filters, setFilters] = useState<SearchFilters>({ ...IDEAL_WEEKEND_FILTERS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [trackIt, setTrackIt] = useState<ScoredItinerary | null>(null);
  const [airlines, setAirlines] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);

  const dates = useMemo(() => {
    if (mode === "weekend") {
      const w = weekendFromSaturday(saturday, shape);
      return { departDate: w.departDate, returnDate: w.returnDate as string | undefined };
    }
    return { departDate, returnDate: returnDate || undefined };
  }, [mode, saturday, shape, departDate, returnDate]);

  const request = useMemo<SearchRequestInput>(
    () => ({ origin, destination, departDate: dates.departDate, returnDate: dates.returnDate, adults, cabin, currency: "EUR", filters }),
    [origin, destination, dates, adults, cabin, filters],
  );

  const run = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true);
    setError(null);
    try {
      setRes(await postJson<SearchResponse>("/api/search", request));
      setAirlines(new Set());
      setVisible(PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [origin, destination, request, t]);

  const sorted = useMemo(() => (res ? sortItineraries(filterByCarriers(res.itineraries, airlines), sort) : []), [res, sort, airlines]);
  const label = `${getAirport(origin)?.city ?? origin} → ${getAirport(destination)?.city ?? destination} · ${dates.departDate}${dates.returnDate ? ` – ${dates.returnDate}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow rounded-b-3xl pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.search.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.search.subtitle}</p>
      </section>

      <Card className="-mt-2 p-4 sm:p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_auto] md:items-end">
            <Field label={t.common.from}>
              <AirportPicker value={origin} onChange={setOrigin} placeholder={t.common.airportPlaceholder} exclude={[destination]} />
            </Field>
            <Button
              variant="ghost"
              className="hidden md:inline-flex h-10 w-10 px-0 mb-0"
              aria-label="swap"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Field label={t.common.to}>
              <AirportPicker value={destination} onChange={setDestination} placeholder={t.common.airportPlaceholder} exclude={[origin]} />
            </Field>
            <Field label={t.common.adults}>
              <Stepper value={adults} onChange={setAdults} />
            </Field>
            <Field label={t.common.cabin}>
              <Select value={cabin} onChange={(e) => setCabin(e.target.value as SearchRequestInput["cabin"])} className="w-44">
                {(["economy", "premium_economy", "business", "first"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t.common[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "weekend", label: t.common.weekend },
                { value: "custom", label: t.common.customDates },
              ]}
            />
            {mode === "weekend" ? (
              <WeekendPicker
                saturday={saturday}
                shape={shape}
                onChange={(v) => {
                  setSaturday(v.saturday);
                  setShape(v.shape);
                }}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 sm:max-w-md">
                <Field label={t.common.depart}>
                  <Input type="date" value={departDate} min={todayIso()} onChange={(e) => setDepartDate(e.target.value)} />
                </Field>
                <Field label={`${t.common.return} · ${t.common.oneWay}: —`}>
                  <Input type="date" value={returnDate} min={departDate} onChange={(e) => setReturnDate(e.target.value)} />
                </Field>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-ink-2 hover:text-ink">
              <SlidersHorizontal className="h-4 w-4" /> {t.common.advanced}
              <span className={cx("text-xs text-ink-3 transition", showAdvanced && "rotate-180")}>▾</span>
            </button>
            {showAdvanced && <TimeWindows value={filters} onChange={setFilters} showInbound={Boolean(dates.returnDate)} />}
            {!showAdvanced && (
              <p className="text-xs text-ink-3">
                {t.filters.ideal}: {t.filters.idealHint}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!origin || !destination}>
              <Search className="h-4 w-4" /> {loading ? t.common.searching : t.common.search}
            </Button>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {error && <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
        {loading && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-3">{t.common.polling}</p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        )}
        {res && !loading && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <ProviderBar providers={res.providers} count={res.itineraries.length} cached={res.cached} />
              <Segmented
                value={sort}
                onChange={setSort}
                options={(["best", "cheapest", "fastest", "comfort"] as SortKey[]).map((k) => ({ value: k, label: t.filters[k] }))}
              />
            </div>
            <AirlineFilter list={res.itineraries} selected={airlines} onChange={setAirlines} />
            {sorted.length === 0 ? (
              <Card className="p-8 text-center text-ink-2">{t.common.nothingFound}</Card>
            ) : (
              <div className="flex flex-col gap-3">
                {sorted.slice(0, visible).map((it) => (
                  <FlightCard key={it.id} it={it} adults={adults} onTrack={setTrackIt} />
                ))}
                {sorted.length > visible && (
                  <Button variant="secondary" className="self-center" onClick={() => setVisible((v) => v + PAGE)}>
                    {t.common.showMore} ({sorted.length - visible})
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {trackIt && (
        <WatchDialog
          open
          onClose={() => setTrackIt(null)}
          params={{ kind: "search", request }}
          defaultLabel={label}
          currentPrice={trackIt.price.amount}
          currency={trackIt.price.currency}
        />
      )}
    </div>
  );
}
