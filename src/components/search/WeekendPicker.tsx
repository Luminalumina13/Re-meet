"use client";

import { useMemo } from "react";
import { upcomingWeekends, todayIso, type WeekendShape } from "@/lib/domain/dates";
import { useI18n } from "@/lib/i18n";
import { Chip, Segmented } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";

const SHAPES: WeekendShape[] = ["sat-sun", "fri-sun", "sat-mon", "fri-mon", "thu-sun"];

export function WeekendPicker({
  saturday,
  shape,
  onChange,
}: {
  saturday: string;
  shape: WeekendShape;
  onChange: (v: { saturday: string; shape: WeekendShape }) => void;
}) {
  const { t, locale } = useI18n();
  const weekends = useMemo(() => upcomingWeekends(todayIso(), 10, shape), [shape]);
  return (
    <div className="flex flex-col gap-3">
      <Segmented value={shape} onChange={(s) => onChange({ saturday, shape: s })} options={SHAPES.map((s) => ({ value: s, label: t.filters.shape[s] }))} />
      <div className="flex flex-wrap gap-2">
        {weekends.map((w) => (
          <Chip key={w.saturday} active={w.saturday === saturday} onClick={() => onChange({ saturday: w.saturday, shape })} title={`${w.departDate} → ${w.returnDate}`}>
            {fmtDate(w.departDate, locale, { day: "numeric", month: "short" })}
            <span className="text-ink-3">–</span>
            {fmtDate(w.returnDate, locale, { day: "numeric", month: "short" })}
          </Chip>
        ))}
      </div>
    </div>
  );
}
