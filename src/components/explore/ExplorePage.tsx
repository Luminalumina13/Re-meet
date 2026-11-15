"use client";

import { useCallback, useMemo, useState } from "react";
import { Bell, Compass, SlidersHorizontal } from "lucide-react";
import type { SearchFilters } from "@/lib/domain/types";
import type { ExploreDestination, ExploreResponse } from "@/lib/explore/types";
import type { ExploreRequestInput } from "@/lib/api/schemas";
import { IDEAL_WEEKEND_FILTERS } from "@/lib/domain/filters";
import { nextSaturday, todayIso, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { cx } from "@/lib/format";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { Button, Card, Chip, Field, Input, Segmented, Skeleton, Stepper, Switch } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { WeekendPicker } from "@/components/search/WeekendPicker";
import { TimeWindows } from "@/components/search/TimeWindows";
import { ProviderBar } from "@/components/search/ProviderBar";
import { FlightCard } from "@/components/search/FlightCard";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { DestinationCard } from "./DestinationCard";

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
  const [origin, setOrigin] = useState("WAW");
  const [saturday, setSaturday] = useState(() => nextSaturday(todayIso()));
  const [shape, setShape] = useState<WeekendShape>("sat-sun");
  const [maxHours, setMaxHours] = useState(4);
  const [directOnly, setDirectOnly] = useState(false);
  const [budget, setBudget] = useState("");
  const [adults, setAdults] = useState(1);
  const [filters, setFilters] = useState<SearchFilters>({ ...IDEAL_WEEKEND_FILTERS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<ExploreResponse | null>(null);
  const [sort, setSort] = useState<SortKey>("best");
  const [country, setCountry] = useState<string | null>(null);
  const [details, setDetails] = useState<ExploreDestination | null>(null);
  const [track, setTrack] = useState(false);

  const weekend = useMemo(() => weekendFromSaturday(saturday, shape), [saturday, shape]);
  const request = useMemo<ExploreRequestInput>(
    () => ({
      origin,
      departDate: weekend.departDate,
      returnDate: weekend.returnDate,
      adults,
      cabin: "economy",
      currency: "EUR",
      maxFlightHours: maxHours,
      filters: {
        ...filters,
        maxStops: directOnly ? 0 : filters.maxStops,
        maxPrice: budget ? Number(budget) : filters.maxPrice,
      },
    }),
    [origin, weekend, adults, maxHours, filters, directOnly, budget],
  );

  const run = useCallback(async () => {
    if (!origin) return;
    setLoading(true);
    setError(null);
    try {
      setRes(await postJson<ExploreResponse>("/api/explore", request));
      setCountry(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [origin, request, t]);

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
    const q = new URLSearchParams({ from: origin, to: d.best.legs[0].to, sat: saturday, shape });
    return `/?${q}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow rounded-b-3xl pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.explore.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.explore.subtitle}</p>
      </section>

      <Card className="-mt-2 p-4 sm:p-6">
        <form
          className="grid gap-6 lg:grid-cols-[1fr_1.2fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label={t.common.from}>
                <AirportPicker value={origin} onChange={setOrigin} placeholder={t.common.airportPlaceholder} />
              </Field>
              <Field label={t.common.adults}>
                <Stepper value={adults} onChange={setAdults} />
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
            <Field label={t.common.weekend}>
              <WeekendPicker
                saturday={saturday}
                shape={shape}
                onChange={(v) => {
                  setSaturday(v.saturday);
                  setShape(v.shape);
                }}
              />
            </Field>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <button type="button" onClick={() => setShowAdvanced((s) => !s)} className="inline-flex items-center gap-2 self-start text-sm font-semibold text-ink-2 hover:text-ink">
                <SlidersHorizontal className="h-4 w-4" /> {t.common.advanced}
                <span className={cx("text-xs text-ink-3 transition", showAdvanced && "rotate-180")}>▾</span>
              </button>
              {showAdvanced ? (
                <TimeWindows value={filters} onChange={setFilters} />
              ) : (
                <p className="text-xs text-ink-3">
                  {t.filters.ideal}: {t.filters.idealHint}
                </p>
              )}
            </div>
            <div className="mt-auto flex justify-end">
              <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!origin}>
                <Compass className="h-4 w-4" /> {loading ? t.explore.finding : t.explore.find}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {error && <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
        {loading && (
          <>
            <p className="text-sm text-ink-3">{t.explore.polling}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((d) => (
                  <DestinationCard key={d.key} d={d} searchHref={searchHref(d)} onDetails={() => setDetails(d)} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {details && (
        <Modal open wide onClose={() => setDetails(null)} title={`${details.city}${details.country ? `, ${details.country}` : ""}`}>
          <div className="flex flex-col gap-3">
            <FlightCard it={details.best} adults={adults} />
            {details.cheapest.id !== details.best.id && <FlightCard it={details.cheapest} adults={adults} />}
          </div>
        </Modal>
      )}
      {track && res && (
        <WatchDialog
          open
          onClose={() => setTrack(false)}
          params={{ kind: "explore", request }}
          defaultLabel={`${getAirport(origin)?.city ?? origin} → ✈ ≤ ${maxHours} ${t.meetup.hours} · ${weekend.departDate}`}
          currentPrice={res.destinations.length ? Math.min(...res.destinations.map((d) => d.cheapest.price.amount)) : undefined}
          currency="EUR"
        />
      )}
    </div>
  );
}
