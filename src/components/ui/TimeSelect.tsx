"use client";

import { Select } from "./primitives";

const OPTIONS: string[] = [];
for (let m = 0; m < 24 * 60; m += 30) {
  OPTIONS.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

export function TimeSelect({ value, onChange, anyLabel, className }: { value?: string; onChange: (v?: string) => void; anyLabel: string; className?: string }) {
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} className={className}>
      <option value="">{anyLabel}</option>
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </Select>
  );
}
