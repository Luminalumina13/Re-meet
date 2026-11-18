"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { Block, Inline } from "@/lib/legal/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((x, i) => {
        if (x.t === "b") return <strong key={i}>{x.v}</strong>;
        if (x.t === "todo") return <mark key={i} className="rounded bg-warn/20 px-1 font-semibold text-ink">{x.v}</mark>;
        if (x.t === "a") {
          const cls = "font-semibold text-accent-text underline underline-offset-2 hover:no-underline";
          return x.href.startsWith("/") ? (
            <Link key={i} href={x.href} className={cls}>
              {x.v}
            </Link>
          ) : (
            <a key={i} href={x.href} className={cls} target="_blank" rel="noreferrer noopener">
              {x.v}
            </a>
          );
        }
        return <span key={i}>{x.v}</span>;
      })}
    </>
  );
}

/** A legal document in the language the visitor chose; both versions come from the server. */
export function LegalView({ docs }: { docs: Record<"uk" | "en", Block[]> }) {
  const { lang, t } = useI18n();
  const blocks = docs[lang] ?? docs.uk;
  const sections = blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");
  return (
    <article className="mx-auto max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h1":
            return (
              <div key={i}>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{b.text}</h1>
              </div>
            );
          case "h2":
            return (
              <h2 key={i} id={b.id} className="mt-10 scroll-mt-20 text-xl font-extrabold tracking-tight">
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-6 text-base font-bold">
                {b.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink-2">
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines items={it} />
                  </li>
                ))}
              </ul>
            );
          default: {
            // The first paragraph under the title is the version/date line.
            const meta = i === 1;
            return (
              <div key={i}>
                <p className={meta ? "mt-3 text-sm text-ink-3" : "mt-3 text-[15px] leading-relaxed text-ink-2"}>
                  <Inlines items={b.inline} />
                </p>
                {meta && sections.length > 0 && (
                  <nav aria-label={t.legal.contents} className="mt-6 rounded-2xl border border-border bg-surface p-4">
                    <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{t.legal.contents}</p>
                    <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                      {sections.map((s) => (
                        <li key={s.id}>
                          <a href={`#${s.id}`} className="text-ink-2 hover:text-accent-text">
                            {s.text}
                          </a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
              </div>
            );
          }
        }
      })}
    </article>
  );
}
