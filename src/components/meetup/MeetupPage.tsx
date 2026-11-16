"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, SlidersHorizontal, Trash2, Users, X } from "lucide-react";
import type { Friend, MeetupResponse } from "@/lib/meetup/types";
import type { MeetupRequestInput } from "@/lib/api/schemas";
import { useSearchFilters } from "@/lib/useSearchFilters";
import { buildMeetupQuery, parseMeetupQuery } from "@/lib/share";
import { ShareButton } from "@/components/ShareButton";
import { nextSaturday, todayIso, weekendFromSaturday, type WeekendShape } from "@/lib/domain/dates";
import { getAirport } from "@/lib/data/airports";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { cx, fmtMoney } from "@/lib/format";
import { AirportPicker } from "@/components/ui/AirportPicker";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, Card, Field, Input, Segmented, Skeleton, Switch } from "@/components/ui/primitives";
import { WeekendPicker } from "@/components/search/WeekendPicker";
import { TimeWindows, idealHint } from "@/components/search/TimeWindows";
import { ProviderBar } from "@/components/search/ProviderBar";
import { WatchDialog } from "@/components/watch/WatchDialog";
import { PlanCard } from "./PlanCard";
import { Frontier } from "./Frontier";
import { SERIES } from "./Timeline";
import { errorText } from "@/lib/errorText";

let seq = 3;
const uid = () => `f${++seq}`;

export function MeetupPage() {
  const { t, locale } = useI18n();
  const params = useSearchParams();
  // A shared link pre-fills the planner (friends, places, dates) and runs it; bad values are ignored.
  const [seed] = useState(() => parseMeetupQuery(params));
  const [friends, setFriends] = useState<Friend[]>(
    () =>
      seed.friends?.map((f, i) => ({ id: `s${i + 1}`, name: f.name, origins: f.origins })) ?? [
        { id: "f1", name: "Світлана", origins: ["WAW"] },
        { id: "f2", name: "Андрій", origins: ["BER"] },
        { id: "f3", name: "Олена", origins: ["LIS"] },
      ],
  );
  const [destinations, setDestinations] = useState<string[]>(seed.destinations ?? ["BCN"]);
  // The pre-filled friends and place are examples: shown light and wiped when the user clicks into them.
  const [samples, setSamples] = useState<Set<string>>(
    () => (seed.friends ? new Set() : new Set(["name:f1", "origin:f1:0", "name:f2", "origin:f2:0", "name:f3", "origin:f3:0", "dest:0"])),
  );
  const isSample = (key: string) => samples.has(key);
  const dropSamples = (...keys: string[]) =>
    setSamples((s) => {
      const next = new Set(s);
      for (const k of keys) next.delete(k);
      return next;
    });
  const dropSamplesWithPrefix = (prefix: string) =>
    setSamples((s) => new Set([...s].filter((k) => !k.startsWith(prefix))));
  const [includeOrigins, setIncludeOrigins] = useState(seed.includeOrigins ?? false);
  const [saturday, setSaturday] = useState(() => (seed.saturday && seed.saturday >= todayIso() ? seed.saturday : nextSaturday(todayIso())));
  const [shape, setShape] = useState<WeekendShape>(seed.shape ?? "sat-sun");
  const [mode, setMode] = useState<"weekend" | "custom">(seed.mode ?? "weekend");
  const [departDate, setDepartDate] = useState(() => (seed.departDate && seed.departDate >= todayIso() ? seed.departDate : nextSaturday(todayIso())));
  const [returnDate, setReturnDate] = useState(() => (seed.returnDate && seed.returnDate >= (seed.departDate ?? "") ? seed.returnDate : weekendFromSaturday(nextSaturday(todayIso()), "sat-sun").returnDate));
  const [valuePerHour, setValuePerHour] = useState(seed.valuePerHour ?? 15);
  const [budget, setBudget] = useState(seed.budget ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<MeetupResponse | null>(null);
  const [selected, setSelected] = useState<string | undefined>();
  const [track, setTrack] = useState(false);

  const weekend = useMemo(() => weekendFromSaturday(saturday, shape), [saturday, shape]);
  const dates = useMemo(() => (mode === "weekend" ? { departDate: weekend.departDate, returnDate: weekend.returnDate } : { departDate, returnDate }), [mode, weekend, departDate, returnDate]);
  const { filters, setFilters } = useSearchFilters(dates.departDate);
  const allDest = useMemo(() => {
    const set = new Set(destinations.filter(Boolean));
    if (includeOrigins) for (const f of friends) for (const o of f.origins) if (o) set.add(o);
    return [...set];
  }, [destinations, includeOrigins, friends]);

  const request = useMemo<MeetupRequestInput>(
    () => ({
      friends: friends
        .map((f) => ({ ...f, origins: f.origins.filter(Boolean) }))
        .filter((f) => f.origins.length > 0 && f.name.trim()),
      destinations: allDest,
      departDate: dates.departDate,
      returnDate: dates.returnDate,
      cabin: "economy",
      currency: "EUR",
      filters,
      valuePerHour,
      maxBudgetPerPerson: budget ? Number(budget) : undefined,
      topK: 6,
    }),
    [friends, allDest, dates, filters, valuePerHour, budget],
  );
  const valid = request.friends.length >= 2 && allDest.length >= 1 && Boolean(dates.departDate) && Boolean(dates.returnDate) && dates.returnDate >= dates.departDate;

  const run = useCallback(async () => {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      const r = await postJson<MeetupResponse>("/api/meetup", request);
      setRes(r);
      setSelected(r.plans[0]?.id);
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setLoading(false);
    }
  }, [valid, request, t]);

  const shareQuery = useMemo(
    () => buildMeetupQuery({ friends, destinations, mode, saturday, shape, departDate, returnDate, valuePerHour, budget, includeOrigins }),
    [friends, destinations, mode, saturday, shape, departDate, returnDate, valuePerHour, budget, includeOrigins],
  );
  const fromLink = Boolean(seed.friends);
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

  const colorIndex = useCallback((id: string) => Math.max(0, friends.findIndex((f) => f.id === id)), [friends]);
  const plans = useMemo(() => {
    if (!res) return [];
    if (!selected) return res.plans;
    const sel = res.plans.find((p) => p.id === selected);
    return sel ? [sel, ...res.plans.filter((p) => p.id !== selected)] : res.plans;
  }, [res, selected]);

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="hero-glow pb-8 pt-10 sm:pt-14">
        <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t.meetup.title}</h1>
        <p className="mt-3 max-w-xl text-ink-2">{t.meetup.subtitle}</p>
      </section>

      <Card className="-mt-2 p-4 sm:p-6">
        <form
          className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Users className="h-4 w-4 text-accent-text" /> {t.meetup.friends}
            </div>
            <div className="flex flex-col gap-2">
              {friends.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[10px_1fr_1.3fr_auto] items-start gap-2">
                  <span className="mt-3.5 h-2.5 w-2.5 rounded-full" style={{ background: SERIES[i % SERIES.length] }} />
                  <Input
                    value={f.name}
                    placeholder={t.meetup.friendName}
                    className={cx(isSample(`name:${f.id}`) && "text-ink-3")}
                    onFocus={() => {
                      if (!isSample(`name:${f.id}`)) return;
                      dropSamples(`name:${f.id}`);
                      setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, name: "" } : x)));
                    }}
                    onChange={(e) => setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, name: e.target.value } : x)))}
                  />
                  <div className="flex flex-col gap-1.5">
                    {f.origins.map((o, k) => (
                      <div key={k} className="flex items-center gap-1">
                        <AirportPicker
                          className="flex-1"
                          value={o}
                          sample={isSample(`origin:${f.id}:${k}`)}
                          onSampleFocus={() => dropSamples(`origin:${f.id}:${k}`)}
                          onChange={(v) => setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, origins: x.origins.map((y, j) => (j === k ? v : y)) } : x)))}
                          placeholder={t.common.airportPlaceholder}
                        />
                        {f.origins.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-10 w-8 shrink-0 px-0"
                            onClick={() => {
                              dropSamplesWithPrefix(`origin:${f.id}:`);
                              setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, origins: x.origins.filter((_, j) => j !== k) } : x)));
                            }}
                            aria-label={t.meetup.removeAirport}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {f.origins.length < 4 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 self-start text-xs font-semibold text-ink-3 hover:text-accent-text"
                        onClick={() => setFriends((fs) => fs.map((x) => (x.id === f.id ? { ...x, origins: [...x.origins, ""] } : x)))}
                      >
                        <Plus className="h-3 w-3" /> {t.meetup.addAirport}
                      </button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="h-10 w-10 px-0" disabled={friends.length <= 2} onClick={() => setFriends((fs) => fs.filter((x) => x.id !== f.id))} aria-label={t.common.delete}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {friends.length < 6 && (
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setFriends((fs) => [...fs, { id: uid(), name: "", origins: [""] }])}>
                  <Plus className="h-4 w-4" /> {t.meetup.addFriend}
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.meetup.destination}</span>
              {destinations.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                  <AirportPicker
                    value={d}
                    sample={isSample(`dest:${i}`)}
                    onSampleFocus={() => dropSamples(`dest:${i}`)}
                    onChange={(v) => setDestinations((ds) => ds.map((x, j) => (j === i ? v : x)))}
                    placeholder={t.common.airportPlaceholder}
                  />
                  <Button variant="ghost" size="sm" className="h-10 w-10 px-0" disabled={destinations.length <= 1} onClick={() => {
                      dropSamplesWithPrefix("dest:");
                      setDestinations((ds) => ds.filter((_, j) => j !== i));
                    }} aria-label={t.common.delete}>
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
            <Field label={t.meetup.valuePerHour} hint={t.meetup.valueHint}>
              <div className="flex flex-col gap-3">
                <Segmented
                  value={String(valuePerHour)}
                  onChange={(v) => setValuePerHour(Number(v))}
                  options={[
                    { value: "5", label: t.meetup.priorityCheap },
                    { value: "15", label: t.meetup.priorityBalanced },
                    { value: "40", label: t.meetup.priorityTime },
                  ]}
                />
                <p className="text-sm text-ink-2">{t.meetup.valueSentence.replace("{amount}", fmtMoney({ amount: valuePerHour, currency: "EUR" }, locale))}</p>
                <details className="text-xs text-ink-3">
                  <summary className="cursor-pointer font-semibold hover:text-ink">{t.meetup.valueFine}</summary>
                  <input type="range" min={1} max={60} step={1} value={valuePerHour} onChange={(e) => setValuePerHour(Number(e.target.value))} className="mt-2 w-full" aria-label={t.meetup.valuePerHour} />
                </details>
              </div>
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
                <TimeWindows value={filters} onChange={setFilters} departDate={dates.departDate} />
              ) : (
                <p className="text-xs text-ink-3">
                  {t.filters.ideal}: {idealHint(t, dates.departDate)}
                </p>
              )}
            </div>
            <div className="flex items-start justify-end gap-3">
              <ShareButton path="/meetup" query={shareQuery} disabled={!valid} />
              <SubmitButton icon={<Users className="h-4 w-4" />} idle={t.meetup.plan} busy={t.meetup.planning} loading={loading} disabled={!valid} />
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
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] items-start">
                <div className="flex flex-col gap-4">
                  {plans.map((p, i) => (
                    <PlanCard key={p.id} plan={p} rank={res.plans.indexOf(p) + 1} departDate={dates.departDate} returnDate={dates.returnDate} colorIndex={colorIndex} highlight={i === 0} onTrack={i === 0 ? () => setTrack(true) : undefined} />
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
          defaultLabel={`${t.nav.meetup}: ${allDest.map((d) => getAirport(d)?.city ?? d).join("/")} · ${dates.departDate}`}
          currentPrice={res.plans[0]?.totalPrice}
          currency="EUR"
        />
      )}
    </div>
  );
}
