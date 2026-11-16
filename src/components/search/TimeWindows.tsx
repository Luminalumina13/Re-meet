"use client";

import type { SearchFilters } from "@/lib/domain/types";
import { FRIDAY_DEPART_AFTER, idealFiltersFor } from "@/lib/domain/filters";
import { useI18n } from "@/lib/i18n";
import { Field, Select, Switch } from "@/components/ui/primitives";
import { TimeSelect } from "@/components/ui/TimeSelect";

export function isIdeal(f: SearchFilters, departDate?: string): boolean {
  const ideal = idealFiltersFor(departDate);
  return JSON.stringify({ o: f.outbound ?? {}, i: f.inbound ?? {} }) === JSON.stringify({ o: ideal.outbound, i: ideal.inbound });
}

/** One-line description of the default windows for this departure day. */
export function idealHint(t: ReturnType<typeof useI18n>["t"], departDate?: string): string {
  return idealFiltersFor(departDate).outbound?.departAfter === FRIDAY_DEPART_AFTER ? t.filters.idealHintFriday : t.filters.idealHint;
}

export function TimeWindows({
  value,
  onChange,
  departDate,
  showInbound = true,
}: {
  value: SearchFilters;
  onChange: (f: SearchFilters) => void;
  /** Departure day: decides what "ideal" means (afternoon on Fridays). */
  departDate?: string;
  showInbound?: boolean;
}) {
  const { t } = useI18n();
  const o = value.outbound ?? {};
  const i = value.inbound ?? {};
  const set = (patch: Partial<SearchFilters>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-4">
      <Switch
        checked={isIdeal(value, departDate)}
        onChange={(on) => {
          const ideal = idealFiltersFor(departDate);
          set(on ? { outbound: ideal.outbound, inbound: ideal.inbound } : { outbound: {}, inbound: {} });
        }}
        label={t.filters.ideal}
        hint={idealHint(t, departDate)}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.filters.outboundDepart}</legend>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t.filters.after}>
              <TimeSelect value={o.departAfter} anyLabel="—" onChange={(v) => set({ outbound: { ...o, departAfter: v } })} />
            </Field>
            <Field label={t.filters.before}>
              <TimeSelect value={o.departBefore} anyLabel="—" onChange={(v) => set({ outbound: { ...o, departBefore: v } })} />
            </Field>
          </div>
        </fieldset>
        {showInbound && (
          <fieldset className="rounded-xl border border-border p-3">
            <legend className="px-1 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.filters.inboundArrive}</legend>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t.filters.after}>
                <TimeSelect value={i.arriveAfter} anyLabel="—" onChange={(v) => set({ inbound: { ...i, arriveAfter: v } })} />
              </Field>
              <Field label={t.filters.before}>
                <TimeSelect value={i.arriveBefore} anyLabel="—" onChange={(v) => set({ inbound: { ...i, arriveBefore: v } })} />
              </Field>
            </div>
          </fieldset>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t.filters.maxStops}>
          <Select value={value.maxStops ?? ""} onChange={(e) => set({ maxStops: e.target.value === "" ? undefined : Number(e.target.value) })}>
            <option value="">{t.filters.any}</option>
            <option value="0">{t.common.direct}</option>
            <option value="1">{t.filters.maxOne}</option>
          </Select>
        </Field>
        <Field label={t.filters.maxPrice}>
          <input
            className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            type="number"
            min={0}
            placeholder="—"
            value={value.maxPrice ?? ""}
            onChange={(e) => set({ maxPrice: e.target.value ? Number(e.target.value) : undefined })}
          />
        </Field>
      </div>
    </div>
  );
}
