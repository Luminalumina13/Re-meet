"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { trackingConfigured, useConsent } from "@/lib/consent";

export function Footer() {
  const { t, lang } = useI18n();
  const [, setConsent] = useConsent();
  const company = lang === "uk" ? "ФОП Павленко С. С." : "Svitlana Pavlenko, sole proprietor";
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link href="/how-it-works" className="font-semibold hover:text-accent-text">
          {t.legal.how}
        </Link>
        <Link href="/faq" className="font-semibold hover:text-accent-text">
          {t.legal.faq}
        </Link>
        <Link href="/privacy" className="font-semibold hover:text-accent-text">
          {t.legal.privacy}
        </Link>
        <Link href="/terms" className="font-semibold hover:text-accent-text">
          {t.legal.terms}
        </Link>
        {trackingConfigured && (
          <button type="button" onClick={() => setConsent("unset")} className="font-semibold hover:text-accent-text">
            {t.consent.settings}
          </button>
        )}
        <span>
          © {new Date().getFullYear()} {company}. {t.legal.rights}
        </span>
      </div>
      <p>Re:meeet · Make time together last longer · Kiwi.com · lastminute.com · Ryanair · Duffel</p>
    </footer>
  );
}
