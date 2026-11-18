"use client";

import { howto } from "@/content/howto";
import { useI18n } from "@/lib/i18n";
import { FeedbackForm } from "./FeedbackForm";

/** The FAQ page body: native <details> accordions (work without JavaScript) and the question form. */
export function Faq() {
  const { lang } = useI18n();
  const c = howto[lang].faq;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">{c.title}</h1>
      <p className="mt-3 text-base leading-relaxed text-ink-2">{c.lead}</p>
      <div className="mt-6 flex flex-col gap-2">
        {c.items.map((x) => (
          <details key={x.q} className="group rounded-xl border border-border bg-surface px-4 py-3">
            <summary className="cursor-pointer list-none font-semibold text-ink marker:hidden">
              <span className="mr-2 inline-block text-ink-3 transition group-open:rotate-90">›</span>
              {x.q}
            </summary>
            <p className="mt-2 leading-relaxed text-ink-2">{x.a}</p>
          </details>
        ))}
      </div>
      <FeedbackForm />
    </div>
  );
}
