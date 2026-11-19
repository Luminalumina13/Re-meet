"use client";

import { HeroEntries, Highlights } from "@/components/home/Landing";
import { HowLink } from "@/components/info/HowLink";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, Search, SlidersHorizontal } from "lucide-react";
import type { SearchResponse, ScoredItinerary } from "@/lib/domain/types";
import { sortItineraries, type SortKey } from "@/lib/domain/filters";
import { todayIso, nextSaturday, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
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

type Mode = "weekend" | "custom";
const PAGE = 15;

const SHAPES: WeekendShape[] = ["sat-sun", "fri-sun", "sat-mon", "fri-mon", "thu-sun"];
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
    if (mode === "weekend") {
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
    setLoading(true);
    setError(null);
    try {
      setRes(await postJson<SearchResponse>("/api/search", request));
      track("search", { kind: "flights" });
      setAirlines(new Set());
      setVisible(PAGE);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setLoading(false);
    }
  }, [origin, destination, request, t]);

  const snapshot = useMemo(
    () => ({ origin, destination, sampleFrom, sampleTo, mode, saturday, shape, departDate, returnDate, adults, children, infants, cabin, filterState, sort, res }),
    [origin, destination, sampleFrom, sampleTo, mode, saturday, shape, departDate, returnDate, adults, children, infants, cabin, filterState, sort, res],
  );
  // A search arriving via the URL (destination card) wins over whatever was stored.
  useSessionSnapshot("remeet:search", snapshot, (s) => {
    const today = todayIso();
    if (s.origin) setOrigin(s.origin);
    if (s.destination) setDestination(s.destination);
    if (s.sampleFrom !== undefined) setSampleFrom(s.sampleFrom);
    if (s.sampleTo !== undefined) setSampleTo(s.sampleTo);
    if (s.mode) setMode(s.mode);
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
    () => buildSearchQuery({ origin, destination, mode, saturday, shape, departDate, returnDate: returnDate || undefined, adults, children, infants, cabin: cabin ?? "economy" }),
    [origin, destination, mode, saturday, shape, departDate, returnDate, adults, children, infants, cabin],
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
            <ShareButton path="/" query={shareQuery} disabled={!origin || !destination} />
            <SubmitButton icon={<Search className="h-4 w-4" />} idle={t.common.search} busy={t.common.searching} loading={loading} disabled={!origin || !destination} />
            </div>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {origin && destination && <FlexDates params={flexParams} onPick={pickDates} />}
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
