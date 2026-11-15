"use client";

import { useState } from "react";
import type { MeetupResponse } from "@/lib/meetup/types";
import { useI18n } from "@/lib/i18n";
import { fmtMoney } from "@/lib/format";

/** Scatter of evaluated plans: hours together (x) vs total price (y); frontier highlighted. */
export function Frontier({ res, selected, onSelect }: { res: MeetupResponse; selected?: string; onSelect: (planId: string) => void }) {
  const { t, locale } = useI18n();
  const [hover, setHover] = useState<string | null>(null);
  const pts = res.plans.map((p) => ({ id: p.id, h: p.togetherMinutes / 60, price: p.totalPrice, dest: p.destination }));
  const front = new Set(res.frontier.map((f) => f.planId));
  if (pts.length < 2) return null;
  const W = 560;
  const H = 220;
  const pad = { l: 56, r: 16, t: 12, b: 32 };
  const xs = pts.map((p) => p.h);
  const ys = pts.map((p) => p.price);
  const xmin = Math.floor(Math.min(...xs) - 1);
  const xmax = Math.ceil(Math.max(...xs) + 1);
  const ymin = Math.floor((Math.min(...ys) * 0.9) / 50) * 50;
  const ymax = Math.ceil((Math.max(...ys) * 1.05) / 50) * 50;
  const X = (h: number) => pad.l + ((h - xmin) / (xmax - xmin)) * (W - pad.l - pad.r);
  const Y = (p: number) => pad.t + (1 - (p - ymin) / (ymax - ymin)) * (H - pad.t - pad.b);
  const frontierPts = res.frontier.map((f) => ({ x: X(f.togetherMinutes / 60), y: Y(f.totalPrice) }));
  const yTicks = 4;
  const xTicks = 5;
  const hov = pts.find((p) => p.id === hover);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t.meetup.frontier}>
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const v = ymin + ((ymax - ymin) * i) / yTicks;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 8} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="var(--text-3)">
                {Math.round(v)}
              </text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const v = xmin + ((xmax - xmin) * i) / xTicks;
          return (
            <text key={i} x={X(v)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--text-3)">
              {Math.round(v)} {t.meetup.hours}
            </text>
          );
        })}
        <polyline points={frontierPts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p) => {
          const isF = front.has(p.id);
          const sel = p.id === selected;
          return (
            <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)} onClick={() => onSelect(p.id)} style={{ cursor: "pointer" }}>
              <circle cx={X(p.h)} cy={Y(p.price)} r="12" fill="transparent" />
              <circle cx={X(p.h)} cy={Y(p.price)} r={sel ? 7 : 5} fill={isF ? "var(--accent)" : "var(--surface)"} stroke={isF ? "var(--surface)" : "var(--text-3)"} strokeWidth="2" />
            </g>
          );
        })}
      </svg>
      {hov && (
        <div className="pointer-events-none absolute rounded-lg border border-border bg-surface px-2 py-1 text-[11px] shadow-card whitespace-nowrap" style={{ left: `${(X(hov.h) / W) * 100}%`, top: `${(Y(hov.price) / H) * 100}%`, transform: "translate(-50%, -140%)" }}>
          {hov.dest} · {hov.h.toFixed(1)} {t.meetup.hours} · {fmtMoney({ amount: hov.price, currency: res.request.currency }, locale)}
        </div>
      )}
    </div>
  );
}
