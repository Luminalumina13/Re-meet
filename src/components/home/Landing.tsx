"use client";

import Link from "next/link";
import { ArrowRight, Bell, CalendarDays, CalendarRange, Compass, Link2, Plane, Users, type LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/primitives";

const ENTRY_ICONS: LucideIcon[] = [Plane, Compass, Users];
const ENTRY_COLORS = ["var(--e1)", "var(--e2)", "var(--e3)"];
const ENTRY_HREFS = ["#search", "/explore", "/meetup"];
const FEATURE_ICONS: LucideIcon[] = [CalendarDays, CalendarRange, Compass, Users, Bell, Link2];
const FEATURE_HREFS = ["/how-it-works#weekend", "/how-it-works#flex", "/how-it-works#explore", "/how-it-works#meetup", "/how-it-works#watch", "/how-it-works#share"];

/** Three ways in, one per scenario, shown right under the headline. */
export function HeroEntries() {
  const { t } = useI18n();
  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {t.home.entries.map((e, i) => {
        const Icon = ENTRY_ICONS[i];
        return (
          <Link
            key={e.title}
            href={ENTRY_HREFS[i]}
            className="group rounded-2xl border border-border bg-surface p-4 shadow-sm transition hover:border-accent hover:shadow-md"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: ENTRY_COLORS[i] }}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="mt-3 block text-[17px] font-bold">{e.title}</span>
            <span className="mt-1 block text-sm leading-snug text-ink-2">{e.text}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-text">
              {e.cta} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** What the platform can do, how it works in three steps and a note about the app. */
export function Highlights() {
  const { t } = useI18n();
  const h = t.home;
  return (
    <div className="mt-10">
      <h2 className="text-2xl font-extrabold tracking-tight">{h.featuresTitle}</h2>
      <p className="mt-1 text-ink-2">{h.featuresLead}</p>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {h.features.map((f, i) => {
          const Icon = FEATURE_ICONS[i];
          return (
            <Link key={f.title} href={FEATURE_HREFS[i]} className="rounded-2xl border border-border bg-surface p-4 transition hover:border-accent">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-accent-text">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="mt-3 block font-bold">{f.title}</span>
              <span className="mt-1 block text-sm leading-snug text-ink-2">{f.text}</span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-12 text-2xl font-extrabold tracking-tight">{h.stepsTitle}</h2>
      <ol className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {h.steps.map((s, i) => (
          <li key={s.title}>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-accent-ink">{i + 1}</span>
            <span className="mt-2 block font-bold">{s.title}</span>
            <span className="mt-0.5 block text-sm text-ink-2">{s.text}</span>
          </li>
        ))}
      </ol>

      <Card className="mt-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">
            {h.app.title} <span className="ml-1 rounded-full border border-border px-2 py-0.5 align-middle text-[11px] font-medium text-ink-3">{h.app.tag}</span>
          </p>
          <p className="mt-1 text-sm text-ink-2">{h.app.text}</p>
        </div>
        <Link href="/how-it-works" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text">
          {h.app.link} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Card>
    </div>
  );
}
