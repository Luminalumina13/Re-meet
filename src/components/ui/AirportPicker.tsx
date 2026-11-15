"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PlaneTakeoff } from "lucide-react";
import { getAirport, searchAirports } from "@/lib/data/airports";
import { inputCls } from "./primitives";
import { cx } from "@/lib/format";
import type { Airport } from "@/lib/domain/types";

export function AirportPicker({
  value,
  onChange,
  placeholder,
  className,
  exclude = [],
}: {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  className?: string;
  exclude?: string[];
}) {
  const selected = value ? getAirport(value) : undefined;
  const [text, setText] = useState(selected ? `${selected.city} (${selected.iata})` : "");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [results, setResults] = useState<Airport[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Keep the text in sync when the parent changes `value` (e.g. swap origin/destination).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    const a = value ? getAirport(value) : undefined;
    setText(a ? `${a.city} (${a.iata})` : "");
  }

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (a: Airport) => {
    onChange(a.iata);
    setText(`${a.city} (${a.iata})`);
    setOpen(false);
  };

  const update = (q: string) => {
    setText(q);
    const r = searchAirports(q, 8).filter((a) => !exclude.includes(a.iata));
    setResults(r);
    setHi(0);
    setOpen(true);
    if (!q) onChange("");
  };

  return (
    <div ref={ref} className={cx("relative", className)}>
      <PlaneTakeoff className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
      <input
        className={cx(inputCls, "pl-9")}
        value={text}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={() => {
          if (!selected) update(text);
          else setOpen(false);
        }}
        onChange={(e) => update(e.target.value)}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(results.length - 1, h + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(0, h - 1));
          } else if (e.key === "Enter" && results[hi]) {
            e.preventDefault();
            pick(results[hi]);
          }
        }}
      />
      {open && results.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {results.map((a, i) => (
            <li
              key={a.iata}
              role="option"
              aria-selected={i === hi}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(a)}
              onMouseEnter={() => setHi(i)}
              className={cx("flex cursor-pointer items-center justify-between px-3 py-2 text-sm", i === hi ? "bg-accent-soft" : "")}
            >
              <span>
                <span className="font-semibold">{a.city}</span> <span className="text-ink-3">· {a.name}</span>
              </span>
              <span className="font-mono text-xs text-ink-2">{a.iata}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
