"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock, ExternalLink, Plane, Search } from "lucide-react";
import type { ExploreDestination } from "@/lib/explore/types";
import { localTime } from "@/lib/domain/time";
import { useI18n } from "@/lib/i18n";
import { fmtDate, fmtDurationLocalized, fmtMoney } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";

/** Deterministic soft gradient for destinations without a photo. */
function gradientFor(key: string): string {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 62%), hsl(${(h + 50) % 360} 70% 48%))`;
}

export function DestinationCard({ d, searchHref, onDetails }: { d: ExploreDestination; searchHref: string; onDetails: () => void }) {
  const { t, locale } = useI18n();
  const [imgOk, setImgOk] = useState(true);
  const [out, back] = d.best.legs;
  const airlines = [...new Set(d.best.legs.flatMap((l) => l.segments.map((s) => s.carrierName ?? s.carrier)))].join(", ");
  const h = t.meetup.hours;
  const m = t.meetup.minutes;
  return (
    <article className="rise group flex flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-border-strong">
      <button type="button" onClick={onDetails} className="relative h-36 w-full overflow-hidden text-left" aria-label={`${t.explore.details}: ${d.city}`}>
        <div className="absolute inset-0" style={{ background: gradientFor(d.key) }} />
        {d.imageUrl && imgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={d.imageUrl}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-extrabold tracking-tight drop-shadow">{d.city}</h3>
            <p className="truncate text-xs opacity-90">
              {d.country ? `${d.country} · ` : ""}
              {d.airports.join(", ")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] opacity-90">{t.explore.from}</div>
            <div className="text-2xl font-extrabold tabular-nums drop-shadow">{fmtMoney(d.cheapest.price, locale)}</div>
          </div>
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="accent">
            <Plane className="h-3 w-3" /> {fmtDurationLocalized(out.durationMin, h, m)} · {out.stops === 0 ? t.common.direct : `${out.stops} ${out.stops === 1 ? t.common.stop : t.common.stops}`}
          </Badge>
          <Badge tone="good">
            <Clock className="h-3 w-3" /> {fmtDurationLocalized(d.minutesThere, h, m)} {t.explore.there}
          </Badge>
          {d.options > 1 && (
            <Badge>
              {d.options} {t.explore.options}
            </Badge>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-3">{fmtDate(out.departLocal, locale, { weekday: "short", day: "numeric" })}</dt>
          <dd className="tabular-nums">
            {localTime(out.departLocal)} {out.from} → {localTime(out.arriveLocal)} {out.to}
          </dd>
          {back && (
            <>
              <dt className="text-ink-3">{fmtDate(back.departLocal, locale, { weekday: "short", day: "numeric" })}</dt>
              <dd className="tabular-nums">
                {localTime(back.departLocal)} {back.from} → {localTime(back.arriveLocal)} {back.to}
              </dd>
            </>
          )}
        </dl>
        <p className="truncate text-xs text-ink-3">
          {airlines} · {fmtMoney(d.best.price, locale)} · {d.best.providerName}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <Link href={searchHref} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink">
            <Search className="h-3.5 w-3.5" /> {t.explore.more}
          </Link>
          {d.best.deepLink && (
            <a href={d.best.deepLink} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-ink hover:bg-accent-strong">
              {t.common.open} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
