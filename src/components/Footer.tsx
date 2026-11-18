"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t, lang } = useI18n();
  const company = lang === "uk" ? "ФОП Павленко С. С." : "Svitlana Pavlenko, sole proprietor";
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/privacy" className="font-semibold hover:text-accent-text">
          {t.legal.privacy}
        </Link>
        <Link href="/terms" className="font-semibold hover:text-accent-text">
          {t.legal.terms}
        </Link>
        <span>
          © {new Date().getFullYear()} {company}. {t.legal.rights}
        </span>
      </div>
      <p>Re:meeet · Make time together last longer · Kiwi.com · lastminute.com · Ryanair · Duffel</p>
    </footer>
  );
}
