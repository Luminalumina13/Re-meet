"use client";

import { useState } from "react";
import type { PricePoint } from "@/lib/watch/types";

export function Sparkline({ points, currency, locale }: { points: PricePoint[]; currency: string; locale: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <div className="h-12 text-xs text-ink-3 flex items-center">—</div>;
  const W = 280;
  const H = 48;
  const ys = points.map((p) => p.bestPrice);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const X = (i: number) => (i / (points.length - 1)) * (W - 8) + 4;
  const Y = (v: number) => (max === min ? H / 2 : 4 + (1 - (v - min) / (max - min)) * (H - 8));
  const d = points.map((p, i) => `${i ? "L" : "M"}${X(i)},${Y(p.bestPrice)}`).join(" ");
  const h = hover ?? points.length - 1;
  const fmt = (v: number) => new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-12"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(((e.clientX - r.left) / r.width) * (points.length - 1));
          setHover(Math.max(0, Math.min(points.length - 1, i)));
        }}
      >
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <line x1={X(h)} x2={X(h)} y1={0} y2={H} stroke="var(--border-strong)" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* HTML dot so it stays round while the SVG stretches horizontally */}
      <span
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
        style={{ left: `${(X(h) / W) * 100}%`, top: Y(points[h].bestPrice) }}
      />
      <div className="flex justify-between text-[11px] text-ink-3 tabular-nums">
        <span>
          {new Date(points[h].at).toLocaleString(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {fmt(points[h].bestPrice)}
        </span>
        <span>
          min {fmt(min)} · max {fmt(max)}
        </span>
      </div>
    </div>
  );
}
