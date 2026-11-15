"use client";

import { useCallback, useMemo, useState } from "react";
import { Plus, SlidersHorizontal, Trash2, Users } from "lucide-react";
import type { SearchFilters } from "@/lib/domain/types";
import type { Friend, MeetupResponse } from "@/lib/meetup/types";
import type { MeetupRequestInput } from "@/lib/api/schemas";
import { IDEAL_WEEKEND_FILTERS } from "@/lib/domain/filters";
import { nextSaturday, todayIso, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { cx, fmtMoney } from "@/lib/format";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { Button, Card, Field, Input, Skeleton, Switch } from "@/components/ui/primitives";
import { WeekendPicker } from "@/components/search/WeekendPicker";
import { TimeWindows } from "@/components/search/TimeWindows";
import { ProviderBar } from "@/components/search/ProviderBar";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { PlanCard } from "./PlanCard";
import { Frontier } from "./Frontier";
import { SERIES } from "./Timeline";

let seq = 3;
const uid = () => `f${++seq}`;

export function MeetupPage() {
  const { t, locale } = useI18n();
  const [friends, setFriends] = useState<Friend[]>([
    { id: "f1", name: "Світлана", origin: "WAW" },
    { id: "f2", name: "Андрій", origin: "BER" },
    { id: "f3", name: "Олена", origin: "LIS" },
  ]);
  const [destinations, setDestinations] = useState<string[]>(["BCN"]);
  const [includeOrigins, setIncludeOrigins] = useState(false);
  const [saturday, setSaturday] = useState(() => nextSaturday(todayIso()));
  const [shape, setShape] = useState<WeekendShape>("sat-sun");
  const [valuePerHour, setValuePerHour] = useState(15);
  const [budget, setBudget] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({ ...IDEAL_WEEKEND_FILTERS });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<MeetupResponse | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [track, setTrack] = useState(false);

  const weekend = useMemo(() => weekendFromSaturday(saturday, shape), [saturday, shape]);
  const allDest = useMemo(() => {
    const set = new Set(destinations.filter(Boolean));
    if (includeOrigins) for (const f of friends) if (f.origin) set.add(f.origin);
    return [...set];
  }, [destinations, includeOrigins, friends]);

  const request = useMemo<MeetupRequestInput>(
    () => ({
      friends: friends.filter((f) => f.origin && f.name.trim()),
      destinations: allDest,
      departDate: weekend.departDate,
      returnDate: weekend.returnDate,
      cabin: "economy",
      currency: "EUR",
      filters,
      valuePerHour,
      maxBudgetPerPerson: budget ? Number(budget) : undefined,
      topK: 6,
    }),
    [friends, allDest, weekend, filters, valuePerHour, budget],
  );
  const valid = request.friends.length >= 2 && allDest.length >= 1;

  const run = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const r = await postJson<MeetupResponse>("/api/meetup", request);
      setRes(r);
      setSelected(r.plans[0]?.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }, [valid, request, t]);

  const colorIndex = useCallback((id: string) => Math.max(0, friends.findIndex((f) => f.id === id)), [friends]);
  const plans = useMemo(() => {
    if (!res) return [];
    if (!selected) return res.plans;
    const sel = res.plans.find((p) => p.id === selected);
    return sel ? [sel, ...res.plans.filter((p) => p.id !== selected)] : res.plans;
  }, [res, selected]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow rounded-b-3xl pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.meetup.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.meetup.subtitle}</p>
      </section>

      <Card className="-mt-2 p-4 sm:p-6">
        <form
          className="grid gap-6 lg:grid-cols-[1.1fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-accent" /> {t.meetup.friends}
            </div>
            <div className="flex flex-col gap-2">
              {friends.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[10px_1fr_1.3fr_auto] items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                  <Input value={f.name} placeholder={t.meetup.friendName} onChange={(e) => setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))} />
                  <AirportPicker value={f.origin} onChange={(v) => setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, origin: v } : x)))} placeholder={t.common.airportPlaceholder} />
                  <Button variant="ghost" size="sm" className="h-10 w-10 px-0" disabled={friends.length <= 2} onClick={() => setFriends((fs) => fs.filter((x) => x.id !== f.id))} aria-label={t.common.delete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {friends.length < 6 && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setFriends((fs) => [...fs, { id: uid(), name: "", origin: "" }])}>
                  <Plus className="h-4 w-4" /> {t.meetup.addFriend}
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.meetup.destination}</span>
              {destinations.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                  <AirportPicker value={d} onChange={(v) => setDestinations((ds) => ds.map((x, j) => (j === i ? v : x)))} placeholder={t.common.airportPlaceholder} />
                  <Button variant="ghost" size="sm" className="h-10 w-10 px-0" disabled={destinations.length <= 1} onClick={() => setDestinations((ds) => ds.filter((_, j) => j !== i))} aria-label={t.common.delete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {destinations.length < 4 && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setDestinations((ds) => [...ds, ""])}>
                  <Plus className="h-4 w-4" /> {t.meetup.addDestination}
                </Button>
              )}
              <Switch checked={includeOrigins} onChange={setIncludeOrigins} label={t.meetup.includeOrigins} />
            </div>
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
            <Field label={`${t.meetup.valuePerHour}: ${fmtMoney({ amount: valuePerHour, currency: "EUR" }, locale)}/${t.meetup.hours}`} hint={t.meetup.valueHint}>
              <input type="range" min={1} max={60} step={1} value={valuePerHour} onChange={(e) => setValuePerHour(Number(e.target.value))} className="w-full" />
            </Field>
            <Field label={t.meetup.budget}>
              <Input type="number" min={0} value={budget} placeholder="—" onChange={(e) => setBudget(e.target.value)} className="sm:w-48" />
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
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="lg" loading={loading} disabled={!valid}>
                <Users className="h-4 w-4" /> {loading ? t.meetup.planning : t.meetup.plan}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <section className="mt-8 flex flex-col gap-4">
        {error && <div className="rounded-xl border border-critical/40 bg-critical/10 px-4 py-3 text-sm text-critical">{error}</div>}
        {loading && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-3">{t.common.polling}</p>
            <Skeleton className="h-64" />
            <Skeleton className="h-40" />
          </div>
        )}
        {res && !loading && (
          <>
            <ProviderBar providers={res.providers} count={res.plans.length} />
            {res.unreachable.length > 0 && (
              <div className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink-2">
                {t.meetup.unreachable}:{" "}
                {res.unreachable
                  .map((u) => `${friends.find((f) => f.id === u.friendId)?.name ?? u.friendId} → ${getAirport(u.destination)?.city ?? u.destination}`)
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .join(", ")}
              </div>
            )}
            {res.plans.length === 0 ? (
              <Card className="p-8 text-center text-ink-2">{t.meetup.noPlans}</Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[1fr_360px] items-start">
                <div className="flex flex-col gap-4">
                  {plans.map((p, i) => (
                    <PlanCard key={p.id} plan={p} rank={res.plans.indexOf(p) + 1} departDate={weekend.departDate} returnDate={weekend.returnDate} colorIndex={colorIndex} highlight={i === 0} onTrack={i === 0 ? () => setTrack(true) : undefined} />
                  ))}
                </div>
                <Card className="p-4 lg:sticky lg:top-20">
                  <h3 className="text-sm font-bold">{t.meetup.frontier}</h3>
                  <p className="mb-2 text-xs text-ink-3">{t.meetup.alternatives}</p>
                  <Frontier res={res} selected={selected} onSelect={setSelected} />
                </Card>
              </div>
            )}
          </>
        )}
      </section>

      {track && res && (
        <WatchDialog
          open
          onClose={() => setTrack(false)}
          params={{ kind: "meetup", request }}
          defaultLabel={`${t.nav.meetup}: ${allDest.map((d) => getAirport(d)?.city ?? d).join("/")} · ${weekend.departDate}`}
          currentPrice={res.plans[0]?.totalPrice}
          currency="EUR"
        />
      )}
    </div>
  );
}
