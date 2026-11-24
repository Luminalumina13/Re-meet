"use client";

import { addDays } from "@/lib/domain/time";
import { moveWith, rangeProblem } from "@/lib/domain/dateRange";
import { todayIso } from "@/lib/domain/dates";
import { rangeFormToRequest, type RangeForm } from "@/lib/rangeForm";
import { useI18n } from "@/lib/i18n";
import { Field, Input, Segmented } from "@/components/ui/primitives";

/** Error text for the form, or null when it can be searched. */
export function useRangeProblem(f: RangeForm, maxDays: number): string | null {
  const { t } = useI18n();
  const p = rangeProblem(rangeFormToRequest(f), maxDays);
  if (!p) return null;
  return p === "tooLong" ? t.range.tooLong.replace("{n}", String(maxDays)) : t.range[p];
}

const num = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));

/** Flexible dates: a departure window and either a return window or a number of nights. */
export function DateRangeFields({ value, onChange, maxDays, allowOneWay = false }: { value: RangeForm; onChange: (v: RangeForm) => void; maxDays: number; allowOneWay?: boolean }) {
  const { t } = useI18n();
  const set = (patch: Partial<RangeForm>) => onChange({ ...value, ...patch });
  const problem = useRangeProblem(value, maxDays);
  const today = todayIso();
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Field label={t.range.departFrom}>
          <Input
            type="date"
            value={value.from}
            min={today}
            onChange={(e) => {
              const from = e.target.value;
              // The other dates move along, so the windows keep their length and the pickers open on the right month.
              set({ from, until: moveWith(value.until, value.from, from), retFrom: moveWith(value.retFrom, value.from, from), retUntil: moveWith(value.retUntil, value.from, from) });
            }}
          />
        </Field>
        <Field label={t.range.until}>
          <Input type="date" value={value.until} min={value.from} max={addDays(value.from, maxDays - 1)} onChange={(e) => set({ until: e.target.value })} />
        </Field>
      </div>
      <Segmented
        value={value.back}
        onChange={(back) => set({ back })}
        options={[
          { value: "nights" as const, label: t.range.backNights },
          { value: "dates" as const, label: t.range.backDates },
          ...(allowOneWay ? [{ value: "oneway" as const, label: t.range.backNone }] : []),
        ]}
      />
      {value.back === "dates" ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field label={t.range.returnFrom}>
            <Input type="date" value={value.retFrom} min={value.from} onChange={(e) => set({ retFrom: e.target.value, retUntil: moveWith(value.retUntil, value.retFrom, e.target.value) })} />
          </Field>
          <Field label={t.range.until}>
            <Input type="date" value={value.retUntil} min={value.retFrom} onChange={(e) => set({ retUntil: e.target.value })} />
          </Field>
        </div>
      ) : value.back === "nights" ? (
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Field label={t.range.nightsFrom}>
            <Input type="number" inputMode="numeric" min={0} max={30} value={value.minNights} onChange={(e) => { const n = num(e.target.value, 0, 30); set({ minNights: n, maxNights: Math.max(n, value.maxNights) }); }} />
          </Field>
          <Field label={t.range.nightsTo}>
            <Input type="number" inputMode="numeric" min={value.minNights} max={30} value={value.maxNights} onChange={(e) => set({ maxNights: num(e.target.value, 0, 30) })} />
          </Field>
        </div>
      ) : null}
      <p className={problem ? "text-xs font-semibold text-critical" : "text-xs text-ink-3"}>{problem ?? t.range.hint}</p>
    </div>
  );
}
