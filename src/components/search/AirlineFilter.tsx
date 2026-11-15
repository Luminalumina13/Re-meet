"use client";

import type { Itinerary } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n";
import { Chip } from "@/components/ui/primitives";

/** Stable key for an operating airline: IATA code when known, otherwise its name. */
export function carrierKey(s: { carrier: string; carrierName?: string }): string {
  return s.carrier || (s.carrierName ?? "?");
}

export function carriersOf(list: Itinerary[]): { key: string; name: string; count: number }[] {
  const map = new Map<string, { key: string; name: string; count: number }>();
  for (const it of list) {
    const seen = new Set<string>();
    for (const l of it.legs)
      for (const s of l.segments) {
        const key = carrierKey(s);
        if (seen.has(key)) continue;
        seen.add(key);
        const cur = map.get(key) ?? { key, name: s.carrierName ?? s.carrier, count: 0 };
        if (s.carrierName && cur.name === s.carrier) cur.name = s.carrierName;
        cur.count++;
        map.set(key, cur);
      }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Keep itineraries operated only by the selected airlines (empty selection = everything). */
export function filterByCarriers<T extends Itinerary>(list: T[], selected: Set<string>): T[] {
  if (!selected.size) return list;
  return list.filter((it) => it.legs.every((l) => l.segments.every((s) => selected.has(carrierKey(s)))));
}

export function AirlineFilter({ list, selected, onChange }: { list: Itinerary[]; selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { t } = useI18n();
  const carriers = carriersOf(list);
  if (carriers.length < 2) return null;
  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-3">
        {t.common.airlines} · {carriers.length}
        {selected.size > 0 && <span className="normal-case tracking-normal font-medium"> · {t.common.onlyAirlines}</span>}
      </span>
      <div className="flex flex-wrap gap-2">
        <Chip active={selected.size === 0} onClick={() => onChange(new Set())}>
          {t.common.allAirlines}
        </Chip>
        {carriers.map((c) => (
          <Chip key={c.key} active={selected.has(c.key)} onClick={() => toggle(c.key)}>
            {c.name} <span className="text-ink-3 tabular-nums">{c.count}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}
