"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, Compass, SlidersHorizontal } from "lucide-react";
import type { ExploreDestination, ExploreResponse } from "@/lib/explore/types";
import type { ExploreRequestInput } from "@/lib/api/schemas";
import { useSearchFilters } from "@/lib/useSearchFilters";
import { nextSaturday, todayIso, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { cx } from "@/lib/format";
import { useSessionSnapshot } from "@/lib/useSessionSnapshot";
import { buildExploreQuery, buildSearchQuery, parseExploreQuery } from "@/lib/share";
import { ShareButton } from "@/components/ShareButton";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, Card, Chip, Field, Input, Segmented, Skeleton, Stepper, Switch } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { WeekendPicker } from "@/components/search/WeekendPicker";
import { TimeWindows, idealHint } from "@/components/search/TimeWindows";
import { track as trackEvent } from "@/lib/consent";
import { AdSlot } from "@/components/AdSlot";
import { ProviderBar } from "@/components/search/ProviderBar";
import { FlightCard } from "@/components/search/FlightCard";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { DestinationCard } from "./DestinationCard";
import { errorText } from "@/lib/errorText";

type SortKey = "best" | "cheapest" | "time" | "short";

function sortDestinations(list: ExploreDestination[], key: SortKey): ExploreDestination[] {
  const copy = [...list];
  switch (key) {
    case "cheapest":
      return copy.sort((a, b) => a.cheapest.price.amount - b.cheapest.price.amount);
    case "time":
      return copy.sort((a, b) => b.minutesThere - a.minutesThere || a.best.price.amount - b.best.price.amount);
    case "short":
      return copy.sort((a, b) => a.best.legs[0].durationMin - b.best.legs[0].durationMin || a.best.price.amount - b.best.price.amount);
    default:
      return copy;
  }
}

export function ExplorePage() {
  const { t } = useI18n();
  const params = useSearchParams();
  // A shared link pre-fills the form and runs the search; unknown or past values are ignored.
  const [seed] = useState(() => parseExploreQuery(params));
  const [origin, setOrigin] = useState(seed.origin ?? "WAW");
  // The default airport is only an example: shown light and wiped when the field gets focus.
  const [sampleFrom, setSampleFrom] = useState(!seed.origin);
  const [saturday, setSaturday] = useState(() => (seed.saturday && seed.saturday >= todayIso() ? seed.saturday : nextSaturday(todayIso())));
  const [shape, setShape] = useState<WeekendShape>(seed.shape ?? "sat-sun");
  const [mode, setMode] = useState<"weekend" | "custom">(seed.mode ?? "weekend");
  const [departDate, setDepartDate] = useState(() => (seed.departDate && seed.departDate >= todayIso() ? seed.departDate : nextSaturday(todayIso())));
  const [returnDate, setReturnDate] = useState(() => (seed.returnDate && seed.returnDate >= (seed.departDate ?? "") ? seed.returnDate : weekendFromSaturday(nextSaturday(todayIso()), "sat-sun").returnDate));
  const [maxHours, setMaxHours] = useState(seed.maxHours ?? 4);
  const [directOnly, setDirectOnly] = useState(seed.directOnly ?? false);
  const [budget, setBudget] = useState(seed.budget ?? "");
  const [adults, setAdults] = useState(seed.adults ?? 1);
  const [children, setChildren] = useState(seed.children ?? 0);
  const [infants, setInfants] = useState(seed.infants ?? 0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ExploreResponse | null>(null);
  const [sort, setSort] = useState<SortKey>("best");
  const [country, setCountry] = useState<string | null>(null);
  const [details, setDetails] = useState<ExploreDestination | null>(null);
  const [track, setTrack] = useState(false);

  const changeAdults = (n: number) => {
    setAdults(n);
    if (infants > n) setInfants(n);
  };

  const weekend = useMemo(() => weekendFromSaturday(saturday, shape), [saturday, shape]);
  const dates = useMemo(() => (mode === "weekend" ? { departDate: weekend.departDate, returnDate: weekend.returnDate } : { departDate, returnDate }), [mode, weekend, departDate, returnDate]);
  const datesOk = Boolean(dates.departDate && dates.returnDate && dates.returnDate >= dates.departDate);
  const { filters, setFilters, state: filterState, restore: restoreFilters } = useSearchFilters(dates.departDate);
  const request = useMemo<ExploreRequestInput>(
    () => ({
      origin,
      departDate: dates.departDate,
      returnDate: dates.returnDate,
      adults,
      children,
      infants,
      cabin: "economy",
      currency: "EUR",
      maxFlightHours: maxHours,
      filters: {
        ...filters,
        maxStops: directOnly ? 0 : filters.maxStops,
        maxPrice: budget ? Number(budget) : filters.maxPrice,
      },
    }),
    [origin, dates, adults, children, infants, maxHours, filters, directOnly, budget],
  );

  const run = useCallback(async () => {
    if (!origin || !datesOk) return;
    setLoading(true);
    setError(null);
    try {
      setRes(await postJson<ExploreResponse>("/api/explore", request));
      setCountry(null);
      trackEvent("search", { kind: "explore" });
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setLoading(false);
    }
  }, [origin, datesOk, request, t]);

  const shareQuery = useMemo(
    () => buildExploreQuery({ origin, mode, saturday, shape, departDate, returnDate, maxHours, directOnly, budget, adults, children, infants }),
    [origin, mode, saturday, shape, departDate, returnDate, maxHours, directOnly, budget, adults, children, infants],
  );
  const fromLink = Boolean(params.get("from"));
  const autoRan = useRef(false);
  useEffect(() => {
    if (!fromLink || autoRan.current) return;
    // Marked done only when the timer fires: dev-mode double effects cancel the first timer.
    const id = setTimeout(() => {
      if (autoRan.current) return;
      autoRan.current = true;
      void run();
    }, 0);
    return () => clearTimeout(id);
  }, [fromLink, run]);

  const snapshot = useMemo(
    () => ({ origin, sampleFrom, mode, saturday, shape, departDate, returnDate, maxHours, directOnly, budget, adults, children, infants, filterState, sort, res }),
    [origin, sampleFrom, mode, saturday, shape, departDate, returnDate, maxHours, directOnly, budget, adults, children, infants, filterState, sort, res],
  );
  useSessionSnapshot("remeet:explore", snapshot, (s) => {
    if (s.origin) setOrigin(s.origin);
    if (s.sampleFrom !== undefined) setSampleFrom(s.sampleFrom);
    if (s.mode) setMode(s.mode);
    if (s.departDate && s.departDate >= todayIso()) setDepartDate(s.departDate);
    if (s.returnDate && s.returnDate >= todayIso()) setReturnDate(s.returnDate);
    if (s.saturday && s.saturday >= todayIso()) setSaturday(s.saturday);
    if (s.shape) setShape(s.shape);
    if (s.maxHours) setMaxHours(s.maxHours);
    if (s.directOnly !== undefined) setDirectOnly(s.directOnly);
    if (s.budget !== undefined) setBudget(s.budget);
    if (s.adults) setAdults(s.adults);
    if (s.children !== undefined) setChildren(s.children);
    if (s.infants !== undefined) setInfants(s.infants);
    restoreFilters(s.filterState);
    if (s.sort) setSort(s.sort);
    if (s.res) setRes(s.res);
  }, fromLink);

  const countries = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of res?.destinations ?? []) if (d.country) m.set(d.country, (m.get(d.country) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [res]);

  const shown = useMemo(() => {
    const list = (res?.destinations ?? []).filter((d) => !country || d.country === country);
    return sortDestinations(list, sort);
  }, [res, country, sort]);

  const searchHref = (d: ExploreDestination) => {
    // Open the normal search with the same dates (or weekend) and party.
    const base = { origin, destination: d.best.legs[0].to, adults, children, infants };
    return `/?${buildSearchQuery(mode === "weekend" ? { ...base, mode, saturday, shape } : { ...base, mode, departDate: dates.departDate, returnDate: dates.returnDate })}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.explore.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.explore.subtitle}</p>
      </section>

      <Card className="-mt-2 p-4 sm:p-6">
        <form
          className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label={t.common.from}>
                <AirportPicker value={origin} onChange={setOrigin} sample={sampleFrom} onSampleFocus={() => setSampleFrom(false)} placeholder={t.common.airportPlaceholder} />
              </Field>
              <Field label={t.common.adults}>
                <Stepper value={adults} onChange={changeAdults} max={9 - children - infants} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-3">
              <Field label={t.common.children}>
                <Stepper value={children} onChange={setChildren} min={0} max={Math.min(8, 9 - adults - infants)} />
              </Field>
              <Field label={t.common.infants}>
                <Stepper value={infants} onChange={setInfants} min={0} max={Math.min(4, adults)} />
              </Field>
            </div>
            <Field
              label={
                <span className="flex items-baseline justify-between">
                  <span>{t.explore.maxHours}</span>
                  <span className="text-base font-extrabold normal-case tracking-normal text-ink tabular-nums">
                    {t.explore.upTo} {maxHours} {t.meetup.hours}
                  </span>
                </span>
              }
            >
              <input type="range" min={1} max={12} step={1} value={maxHours} onChange={(e) => setMaxHours(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-[11px] text-ink-3 tabular-nums">
                <span>1 {t.meetup.hours}</span>
                <span>6 {t.meetup.hours}</span>
                <span>12 {t.meetup.hours}</span>
              </div>
            </Field>
            <Switch checked={directOnly} onChange={setDirectOnly} label={t.explore.directOnly} />
            <Field label={t.explore.budget}>
              <Input type="number" min={0} value={budget} placeholder="—" onChange={(e) => setBudget(e.target.value)} className="sm:w-48" />
            </Field>
          </div>

          <div className="flex flex-col gap-5">
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
                <div className="grid gap-3 sm:max-w-md sm:grid-cols-2">
                  <Field label={t.common.depart}>
                    <Input
                      type="date"
                      value={departDate}
                      min={todayIso()}
                      onChange={(e) => {
                        setDepartDate(e.target.value);
                        if (returnDate < e.target.value) setReturnDate(e.target.value);
                      }}
                    />
                  </Field>
                  <Field label={t.common.return}>
                    <Input type="date" value={returnDate} min={departDate} onChange={(e) => setReturnDate(e.target.value)} />
                  </Field>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-ink-2 hover:text-ink">
                <SlidersHorizontal className="h-4 w-4" /> {t.common.advanced}
                <span className={cx("text-xs text-ink-3 transition", showAdvanced && "rotate-180")}>▾</span>
              </button>
              {showAdvanced ? (
                <TimeWindows value={filters} onChange={setFilters} departDate={dates.departDate} />
              ) : (
                <p className="text-xs text-ink-3">
                  {t.filters.ideal}: {idealHint(t, dates.departDate)}
                </p>
              )}
            </div>
            <div className="mt-auto flex items-start justify-end gap-3">
              <ShareButton path="/explore" query={shareQuery} disabled={!origin || !datesOk} />
              <SubmitButton icon={<Compass className="h-4 w-4" />} idle={t.explore.find} busy={t.explore.finding} loading={loading} disabled={!origin || !datesOk} />
            </div>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {error && <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
        {loading && (
          <>
            <p className="text-sm text-ink-3">{t.explore.polling}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-80" />
              ))}
            </div>
          </>
        )}
        {res && !loading && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <ProviderBar providers={res.providers} count={res.destinations.length} />
                <span className="text-xs text-ink-3">
                  {getAirport(origin)?.city ?? origin} · {res.destinations.length} {t.explore.destinations} · ✈ ≤ {maxHours} {t.meetup.hours}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "best", label: t.explore.sortBest },
                    { value: "cheapest", label: t.explore.sortCheapest },
                    { value: "time", label: t.explore.sortTime },
                    { value: "short", label: t.explore.sortShort },
                  ]}
                />
                {res.destinations.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setTrack(true)}>
                    <Bell className="h-4 w-4" /> {t.explore.track}
                  </Button>
                )}
              </div>
            </div>
            {countries.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <Chip active={!country} onClick={() => setCountry(null)}>
                  {t.explore.anyCountry}
                </Chip>
                {countries.map(([c, n]) => (
                  <Chip key={c} active={country === c} onClick={() => setCountry(country === c ? null : c)}>
                    {c} <span className="text-ink-3 tabular-nums">{n}</span>
                  </Chip>
                ))}
              </div>
            )}
            {shown.length === 0 ? (
              <Card className="p-8 text-center text-ink-2">{t.explore.nothing}</Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((d) => (
                  <DestinationCard key={d.key} d={d} searchHref={searchHref(d)} onDetails={() => setDetails(d)} />
                ))}
              </div>
            )}
            <AdSlot />
          </>
        )}
      </section>

      {details && (
        <Modal open wide onClose={() => setDetails(null)} title={`${details.city}${details.country ? `, ${details.country}` : ""}`}>
          <div className="flex flex-col gap-3">
            <FlightCard it={details.best} adults={adults + children} />
            {details.cheapest.id !== details.best.id && <FlightCard it={details.cheapest} adults={adults + children} />}
          </div>
        </Modal>
      )}
      {track && res && (
        <WatchDialog
          open
          onClose={() => setTrack(false)}
          params={{ kind: "explore", request }}
          defaultLabel={`${getAirport(origin)?.city ?? origin} → ✈ ≤ ${maxHours} ${t.meetup.hours} · ${dates.departDate}`}
          currentPrice={res.destinations.length ? Math.min(...res.destinations.map((d) => d.cheapest.price.amount)) : undefined}
          currency="EUR"
        />
      )}
    </div>
  );
}
