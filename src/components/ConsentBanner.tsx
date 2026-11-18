"use client";

import Link from "next/link";
import { trackingConfigured, useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/primitives";

/** Equal choices, no pre-ticked boxes; shown until the visitor decides (or asks to change the decision). */
export function ConsentBanner() {
  const { t } = useI18n();
  const [consent, setConsent] = useConsent();
  if (!trackingConfigured || consent !== "unset") return null;
  return (
    <div role="dialog" aria-label={t.consent.title} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-line bg-surface p-4 shadow-lg">
      <p className="text-sm font-bold text-ink">{t.consent.title}</p>
      <p className="mt-1 text-sm text-ink-2">
        {t.consent.text}{" "}
        <Link href="/privacy" className="font-semibold underline hover:text-accent-text">
          {t.legal.privacy}
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setConsent("denied")}>
          {t.consent.reject}
        </Button>
        <Button onClick={() => setConsent("granted")}>{t.consent.accept}</Button>
      </div>
    </div>
  );
}
