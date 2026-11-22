"use client";

import { HeroEntries, Highlights } from "@/components/home/Landing";
import { HowLink } from "@/components/info/HowLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import type { Itinerary, SearchResponse, ScoredItinerary, SearchFilters } from "@/lib/domain/types";
import { sortItineraries, idealFiltersFor, type SortKey } from "@/lib/domain/filters";
import { todayIso, nextSaturday, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { airportPairs, SPREADS, type Spread } from "@/lib/data/nearby";

const addDaysIso = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

/** Cheapest weekends sends a request per day, direction and pair, so it takes fewer pairs than a normal search. */
const CHEAP_PAIRS = 3;
import { searchPairs } from "@/lib/multiSearch";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import type { SearchRequestInput } from "@/lib/api/schemas";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, Card, Field, Input, Segmented, Select, Skeleton, Stepper, Switch } from "@/components/ui/primitives";
import { WeekendPicker } from "./WeekendPicker";
import { TimeWindows, idealHint } from "./TimeWindows";
import { FlightCard } from "./FlightCard";
import { FlexDates, type FlexParams } from "./FlexDates";
import { MultiLegResults } from "./MultiLegResults";
import { CheapPicker, CheapestWeekends } from "./CheapestWeekends";
import type { RankedTrip } from "@/lib/flex/weekends";
import { track } from "@/lib/consent";
import { AdSlot } from "@/components/AdSlot";
import { ProviderBar } from "./ProviderBar";
import { AirlineFilter, filterByCarriers } from "./AirlineFilter";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { cx } from "@/lib/format";
import { useSessionSnapshot } from "@/lib/useSessionSnapshot";
import { buildSearchQuery, parseSearchQuery } from "@/lib/share";
import { ShareButton } from "@/components/ShareButton";
import { useSearchFilters } from "@/lib/useSearchFilters";
import { errorText } from "@/lib/errorText";

type Mode = "weekend" | "cheap" | "multi" | "custom";
const PAGE = 15;

const SHAPES: WeekendShape[] = ["sat-sun", "fri-sun", "sat-mon", "fri-mon", "thu-sun"];
const MODES: Mode[] = ["weekend", "cheap", "multi", "custom"];
export function SearchPage() {
  const { t } = useI18n();
  const params = useSearchParams();
  // A shared link (or a destination card) pre-fills the form; unknown or past values are ignored.
  const [seed] = useState(() => parseSearchQuery(params));
  const [origin, setOrigin] = useState(seed.origin ?? "WAW");
  const [destination, setDestination] = useState(seed.destination ?? "BCN");
  // Default route is only an example: shown light and wiped when the field gets focus.
  const [sampleFrom, setSampleFrom] = useState(!seed.origin);
  const [sampleTo, setSampleTo] = useState(!seed.destination);
  const [mode, setMode] = useState<Mode>(seed.mode ?? "weekend");
  const [saturday, setSaturday] = useState(() => (seed.saturday && seed.saturday >= todayIso() ? seed.saturday : nextSaturday(todayIso())));
  const [shape, setShape] = useState<WeekendShape>(seed.shape ?? "sat-sun");
  // "Cheapest weekends": which formats are acceptable, how many weeks to look ahead, and a counter the search button bumps.
  const [cheapShapes, setCheapShapes] = useState<WeekendShape[]>(["sat-sun", "fri-sun", "sat-mon", "fri-mon"]);
  const [cheapWeeks, setCheapWeeks] = useState(8);
  const [cheapTick, setCheapTick] = useState(0);
  // "Complex route" mode: the form's From/To and depart date are leg 1, these are the legs after it.
  const [extraLegs, setExtraLegs] = useState<{ from: string; to: string; date: string }[]>(() => seed.legs ?? []);
  const [multiRes, setMultiRes] = useState<Itinerary[][] | null>(null);
  const [oSpread, setOSpread] = useState<Spread>(seed.oSpread ?? 0);
  const [dSpread, setDSpread] = useState<Spread>(seed.dSpread ?? 0);
  const [departDate, setDepartDate] = useState(() => (seed.departDate && seed.departDate >= todayIso() ? seed.departDate : nextSaturday(todayIso())));
  const [returnDate, setReturnDate] = useState<string>(() => {
    if (seed.mode === "custom") return seed.returnDate && seed.returnDate >= (seed.departDate ?? "") ? seed.returnDate : "";
    return weekendFromSaturday(nextSaturday(todayIso()), "sat-sun").returnDate;
  });
  const [adults, setAdults] = useState(seed.adults ?? 1);
  const [children, setChildren] = useState(seed.children ?? 0);
  const [infants, setInfants] = useState(seed.infants ?? 0);
  const [cabin, setCabin] = useState<SearchRequestInput["cabin"]>(seed.cabin ?? "economy");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sort, setSort] = useState<SortKey>("best");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SearchResponse | null>(null);
  const [trackIt, setTrackIt] = useState<ScoredItinerary | null>(null);
  const [airlines, setAirlines] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(PAGE);

  const changeAdults = (n: number) => {
    setAdults(n);
    if (infants > n) setInfants(n);
  };

  const dates = useMemo(() => {
    if (mode === "weekend" || mode === "cheap") {
      const w = weekendFromSaturday(saturday, shape);
      return { departDate: w.departDate, returnDate: w.returnDate as string | undefined };
    }
    return { departDate, returnDate: returnDate || undefined };
  }, [mode, saturday, shape, departDate, returnDate]);

  const { filters, setFilters, state: filterState, restore: restoreFilters } = useSearchFilters(dates.departDate);

  const request = useMemo<SearchRequestInput>(
    () => ({ origin, destination, departDate: dates.departDate, returnDate: dates.returnDate, adults, children, infants, cabin, currency: "EUR", filters }),
    [origin, destination, dates, adults, children, infants, cabin, filters],
  );

  const run = useCallback(async () => {
    if (!origin || !destination) return;
    if (mode === "cheap") {
      setCheapTick((n) => n + 1);
      return;
    }
    if (mode === "multi") {
      const legs = [{ from: origin, to: destination, date: departDate }, ...extraLegs];
      if (extraLegs.length === 0) return;
      if (legs.some((l) => !l.from || !l.to || !l.date || l.from === l.to)) {
        setError(t.multi.fill);
        return;
      }
      if (legs.some((l, i) => i > 0 && l.date < legs[i - 1].date)) {
        setError(t.multi.dateOrder);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const base = { adults, children, infants, cabin: cabin ?? "economy", currency: "EUR", filters: { maxStops: filters.maxStops } };
        const found = await Promise.all(legs.map((l) => postJson<SearchResponse>("/api/search", { ...base, origin: l.from, destination: l.to, departDate: l.date })));
        setMultiRes(found.map((r) => r.itineraries));
        setRes(null);
        track("search", { kind: "multi" });
      } catch (e) {
        setError(errorText(e, t));
      } finally {
        setLoading(false);
      }
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMultiRes(null);
      setRes(await searchPairs(airportPairs(origin, destination, oSpread, dSpread), request));
      track("search", { kind: "flights" });
      setAirlines(new Set());
      setVisible(PAGE);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setLoading(false);
    }
  }, [origin, destination, oSpread, dSpread, mode, request, t, extraLegs, departDate, adults, children, infants, cabin, filters.maxStops]);

  const snapshot = useMemo(
    () => ({ origin, destination, sampleFrom, sampleTo, mode, saturday, shape, cheapShapes, cheapWeeks, oSpread, dSpread, departDate, returnDate, adults, children, infants, cabin, filterState, sort, res }),
    [origin, destination, sampleFrom, sampleTo, mode, saturday, shape, cheapShapes, cheapWeeks, oSpread, dSpread, departDate, returnDate, adults, children, infants, cabin, filterState, sort, res],
  );
  // A search arriving via the URL (destination card) wins over whatever was stored.
  useSessionSnapshot("remeet:search", snapshot, (s) => {
    const today = todayIso();
    if (s.origin) setOrigin(s.origin);
    if (s.destination) setDestination(s.destination);
    if (s.sampleFrom !== undefined) setSampleFrom(s.sampleFrom);
    if (s.sampleTo !== undefined) setSampleTo(s.sampleTo);
    if (s.mode && MODES.includes(s.mode)) setMode(s.mode);
    if (Array.isArray(s.cheapShapes)) setCheapShapes(s.cheapShapes.filter((x: WeekendShape) => SHAPES.includes(x)));
    if (s.cheapWeeks) setCheapWeeks(s.cheapWeeks);
    if (SPREADS.includes(s.oSpread as Spread)) setOSpread(s.oSpread as Spread);
    if (SPREADS.includes(s.dSpread as Spread)) setDSpread(s.dSpread as Spread);
    if (s.saturday && s.saturday >= today) setSaturday(s.saturday);
    if (s.shape && SHAPES.includes(s.shape)) setShape(s.shape);
    if (s.departDate && s.departDate >= today) setDepartDate(s.departDate);
    if (s.returnDate && s.returnDate >= today) setReturnDate(s.returnDate);
    if (s.adults) setAdults(s.adults);
    if (s.children !== undefined) setChildren(s.children);
    if (s.infants !== undefined) setInfants(s.infants);
    if (s.cabin) setCabin(s.cabin);
    restoreFilters(s.filterState);
    if (s.sort) setSort(s.sort);
    // Prices go stale, but the list is what the user was reading; they can re-run the search.
    if (s.res) setRes(s.res);
  }, Boolean(params.get("to")));

  const shareQuery = useMemo(
    () =>
      buildSearchQuery({
        origin,
        destination,
        mode: mode === "custom" || mode === "multi" ? mode : "weekend",
        saturday,
        shape,
        departDate,
        returnDate: returnDate || undefined,
        legs: extraLegs.filter((l) => l.from && l.to && l.date && l.from !== l.to),
        oSpread: oSpread === 0 ? undefined : oSpread,
        dSpread: dSpread === 0 ? undefined : dSpread,
        adults,
        children,
        infants,
        cabin: cabin ?? "economy",
      }),
    [origin, destination, mode, saturday, shape, departDate, returnDate, extraLegs, oSpread, dSpread, adults, children, infants, cabin],
  );
  const flexParams = useMemo<FlexParams>(
    () => ({ origin, destination, departDate: dates.departDate, returnDate: dates.returnDate, adults, children, infants, cabin: cabin ?? "economy", currency: "EUR", filters }),
    [origin, destination, dates, adults, children, infants, cabin, filters],
  );
  // Picking a cell of the flexible-dates grid switches to those exact dates and searches them.
  const [searchTick, setSearchTick] = useState(0);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const pickDates = (depart: string, ret?: string) => {
    setMode("custom");
    setDepartDate(depart);
    setReturnDate(ret ?? "");
    setSearchTick((n) => n + 1);
  };
  // A trip picked from the cheapest-weekends list becomes the ordinary weekend search for those dates.
  const pickTrip = (trip: RankedTrip) => {
    setMode("weekend");
    setSaturday(trip.saturday);
    setShape(trip.shape);
    setSearchTick((n) => n + 1);
  };
  // Time windows per day: the user's own if they edited them, otherwise the ideal ones for that weekday (afternoon on Fridays).
  const filtersFor = useCallback((day: string): SearchFilters => (filterState.times ? filters : { ...filters, ...idealFiltersFor(day) }), [filters, filterState.times]);
  // Runs after the new dates are rendered, so the search uses them.
  useEffect(() => {
    if (searchTick > 0) void runRef.current();
  }, [searchTick]);

  // Arriving from a destination card: run the search right away (once).
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !params.get("to")) return;
    // Mark as done only when the timer fires: in dev, React runs effects twice and cancels the first timer.
    const id = setTimeout(() => {
      if (autoRan.current) return;
      autoRan.current = true;
      run();
    }, 0);
    return () => clearTimeout(id);
  }, [params, run]);

  const sorted = useMemo(() => (res ? sortItineraries(filterByCarriers(res.itineraries, airlines), sort) : []), [res, sort, airlines]);
  const label = `${getAirport(origin)?.city ?? origin} → ${getAirport(destination)?.city ?? destination} · ${dates.departDate}${dates.returnDate ? ` – ${dates.returnDate}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow pb-8 pt-10 sm:pt-14">
        <p className="mb-3 text-sm font-semibold tracking-wide text-accent-text">{t.brand.slogan}</p>
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.search.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.search.subtitle}</p>
        <HeroEntries />
      </section>

      <Card id="search" className="-mt-2 p-4 sm:p-6">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_1fr_auto_auto] md:items-end">
            <Field label={t.common.from}>
              <AirportPicker value={origin} onChange={setOrigin} sample={sampleFrom} onSampleFocus={() => setSampleFrom(false)} placeholder={t.common.airportPlaceholder} exclude={[destination]} />
            </Field>
            <Button
              variant="ghost"
              className="hidden md:inline-flex h-10 w-10 px-0 mb-0"
              aria-label="swap"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
                setOSpread(dSpread);
                setDSpread(oSpread);
                setSampleFrom(false);
                setSampleTo(false);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Field label={t.common.to}>
              <AirportPicker value={destination} onChange={setDestination} sample={sampleTo} onSampleFocus={() => setSampleTo(false)} placeholder={t.common.airportPlaceholder} exclude={[origin]} />
            </Field>
            <Field label={t.common.adults}>
              <Stepper value={adults} onChange={changeAdults} max={9 - children - infants} />
            </Field>
            <Field label={t.common.children}>
              <Stepper value={children} onChange={setChildren} min={0} max={Math.min(8, 9 - adults - infants)} />
            </Field>
            <Field label={t.common.infants}>
              <Stepper value={infants} onChange={setInfants} min={0} max={Math.min(4, adults)} />
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
          <div className={cx("grid grid-cols-1 gap-3 sm:grid-cols-2", mode === "multi" && "hidden")}>
            <Field label={t.nearby.from}>
              <Select value={String(oSpread)} onChange={(e) => setOSpread(e.target.value === "country" ? "country" : (Number(e.target.value) as Spread))}>
                {SPREADS.map((s) => (
                  <option key={s} value={String(s)}>
                    {s === 0 ? t.nearby.none : s === "country" ? t.nearby.country : `${t.nearby.within} ${s} ${t.nearby.km}`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t.nearby.to}>
              <Select value={String(dSpread)} onChange={(e) => setDSpread(e.target.value === "country" ? "country" : (Number(e.target.value) as Spread))}>
                {SPREADS.map((s) => (
                  <option key={s} value={String(s)}>
                    {s === 0 ? t.nearby.none : s === "country" ? t.nearby.country : `${t.nearby.within} ${s} ${t.nearby.km}`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="flex flex-col gap-3">
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                if (m === "multi" && extraLegs.length === 0 && origin && destination) setExtraLegs([{ from: destination, to: origin, date: addDaysIso(departDate, 3) }]);
              }}
              options={[
                { value: "weekend", label: t.common.weekend },
                { value: "cheap", label: t.common.cheapWeekends },
                { value: "multi", label: t.common.multiLeg },
                { value: "custom", label: t.common.customDates },
              ]}
            />
            {mode === "cheap" ? (
              <CheapPicker shapes={cheapShapes} onShapes={setCheapShapes} weeks={cheapWeeks} onWeeks={setCheapWeeks} />
            ) : mode === "multi" ? (
              <div className="flex flex-col gap-3">
                <Field label={`${t.multi.leg} 1: ${t.common.depart}`}>
                  <Input type="date" value={departDate} min={todayIso()} onChange={(e) => setDepartDate(e.target.value)} className="sm:max-w-48" />
                </Field>
                {extraLegs.map((l, i) => {
                  const set = (patch: Partial<typeof l>) => setExtraLegs((ls) => ls.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                  return (
                    <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_11rem_auto] sm:items-end">
                      <Field label={`${t.multi.leg} ${i + 2}: ${t.common.from}`}>
                        <AirportPicker value={l.from} onChange={(v) => set({ from: v })} placeholder={t.common.airportPlaceholder} exclude={[l.to]} />
                      </Field>
                      <Field label={t.common.to}>
                        <AirportPicker value={l.to} onChange={(v) => set({ to: v })} placeholder={t.common.airportPlaceholder} exclude={[l.from]} />
                      </Field>
                      <Field label={t.common.depart}>
                        <Input type="date" value={l.date} min={i === 0 ? departDate : extraLegs[i - 1].date} onChange={(e) => set({ date: e.target.value })} />
                      </Field>
                      <Button variant="ghost" size="sm" className="h-10 w-10 px-0" disabled={extraLegs.length <= 1} onClick={() => setExtraLegs((ls) => ls.filter((_, j) => j !== i))} aria-label={t.common.delete}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
                {extraLegs.length < 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => setExtraLegs((ls) => [...ls, { from: ls.length ? ls[ls.length - 1].to : destination, to: (ls.length ? ls[ls.length - 1].to : destination) === origin ? "" : origin, date: addDaysIso(ls.length ? ls[ls.length - 1].date : departDate, 2) }])}
                  >
                    <Plus className="h-4 w-4" /> {t.multi.addLeg}
                  </Button>
                )}
                <p className="text-xs text-ink-3">{t.multi.hint}</p>
              </div>
            ) : mode === "weekend" ? (
              <WeekendPicker
                saturday={saturday}
                shape={shape}
                onChange={(v) => {
                  setSaturday(v.saturday);
                  setShape(v.shape);
                }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:max-w-md">
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
            {showAdvanced && <TimeWindows value={filters} onChange={setFilters} departDate={dates.departDate} showInbound={Boolean(dates.returnDate)} />}
            {!showAdvanced && (
              <p className="text-xs text-ink-3">
                {t.filters.ideal}: {idealHint(t, dates.departDate)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <Switch checked={filters.maxStops === 0} onChange={(on) => setFilters({ ...filters, maxStops: on ? 0 : undefined })} label={t.filters.directOnly} />
            <div className="ml-auto flex items-start gap-3">
            {mode !== "cheap" && <ShareButton path="/" query={shareQuery} disabled={!origin || !destination || (mode === "multi" && extraLegs.length === 0)} />}
            <SubmitButton icon={<Search className="h-4 w-4" />} idle={t.common.search} busy={t.common.searching} loading={loading} disabled={!origin || !destination || (mode === "cheap" && cheapShapes.length === 0) || (mode === "multi" && extraLegs.length === 0)} />
            </div>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {origin && destination && mode === "cheap" && (
          <CheapestWeekends
            params={{ origin, destination, pairs: airportPairs(origin, destination, oSpread, dSpread, CHEAP_PAIRS), adults, children, infants, cabin: cabin ?? "economy", currency: "EUR" }}
            shapes={cheapShapes}
            weeks={cheapWeeks}
            filtersFor={filtersFor}
            tick={cheapTick}
            onPick={pickTrip}
          />
        )}
        {origin && destination && mode !== "cheap" && mode !== "multi" && <FlexDates params={flexParams} onPick={pickDates} />}
        {mode === "multi" && multiRes && !loading && <MultiLegResults legs={multiRes} currency="EUR" />}
        {mode !== "cheap" && error && <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
        {mode !== "cheap" && loading && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-3">{t.common.polling}</p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36" />
            ))}
          </div>
        )}
        {mode !== "cheap" && mode !== "multi" && res && !loading && (
          <>
            <HowLink step="results" label="results" className="-mb-1" />
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
                  <FlightCard key={it.id} it={it} adults={adults + children} onTrack={setTrackIt} />
                ))}
                {sorted.length > visible && (
                  <Button variant="secondary" className="self-center" onClick={() => setVisible((v) => v + PAGE)}>
                    {t.common.showMore} ({sorted.length - visible})
                  </Button>
                )}
              </div>
            )}
            <AdSlot />
          </>
        )}
      </section>

      {!res && !loading && <Highlights />}

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
