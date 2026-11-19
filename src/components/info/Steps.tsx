"use client";

import Link from "next/link";
import { howto, imageSize } from "@/content/howto";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/primitives";

/** The "How it works" page body. */
export function HowItWorks() {
  const { lang } = useI18n();
  const c = howto[lang];
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{c.intro.title}</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-2">{c.intro.lead}</p>

      <ol className="mt-8 flex flex-col gap-10">
        {c.steps.map((s) => (
          <li key={s.id} id={s.id}>
            <h2 className="text-xl font-bold text-ink">{s.title}</h2>
            <p className="mt-2 leading-relaxed text-ink-2">{s.text}</p>
            {s.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.image} alt={s.alt} width={imageSize[s.image]?.[0]} height={imageSize[s.image]?.[1]} loading="lazy" decoding="async" style={(imageSize[s.image]?.[0] ?? 1200) < 1000 ? { maxWidth: 520 } : undefined} className="mt-4 h-auto w-full rounded-2xl border border-border shadow-sm" />
            )}
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-xl font-bold text-ink">{c.tips.title}</h2>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-ink-2">
          {c.tips.items.map((t) => (
            <li key={t} className="leading-relaxed">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 flex flex-wrap items-center gap-3">
        <p className="mr-2 text-lg font-bold text-ink">{c.cta.text}</p>
        <Link href="/">
          <Button variant="primary">{c.cta.search}</Button>
        </Link>
        <Link href="/faq">
          <Button variant="secondary">{c.cta.faq}</Button>
        </Link>
      </section>
    </div>
  );
}
