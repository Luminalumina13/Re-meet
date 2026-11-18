"use client";

import { useEffect } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT, useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";

/** One AdSense unit, labelled as an ad. Renders nothing without IDs or without the visitor's consent. */
export function AdSlot() {
  const { t } = useI18n();
  const [consent] = useConsent();
  const on = Boolean(ADSENSE_CLIENT && ADSENSE_SLOT) && consent === "granted";

  useEffect(() => {
    if (!on) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ??= []).push({});
    } catch {}
  }, [on]);

  if (!on) return null;
  return (
    <aside aria-label={t.consent.ad} className="mt-6">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{t.consent.ad}</p>
      <ins className="adsbygoogle block" style={{ display: "block" }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={ADSENSE_SLOT} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
