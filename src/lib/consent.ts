"use client";

import { readPref, usePref, writePref } from "@/lib/prefs";

/**
 * Analytics and ads are off until the visitor agrees. The IDs come from the build environment
 * (NEXT_PUBLIC_* values are inlined by `next build`, so they are set as GitHub Actions variables).
 * With no IDs configured nothing loads and no banner is shown.
 */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const ADSENSE_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT ?? "";
export const trackingConfigured = Boolean(GA_ID || ADSENSE_CLIENT);

export type Consent = "granted" | "denied" | "unset";
const KEY = "consent";
const VALID = ["granted", "denied", "unset"] as const;

export function useConsent(): [Consent, (c: Consent) => void] {
  return usePref<Consent>(KEY, "unset", VALID);
}

export const readConsent = (): Consent => {
  const v = readPref(KEY);
  return v === "granted" || v === "denied" ? v : "unset";
};
export const saveConsent = (c: Consent) => writePref(KEY, c);

type Gtag = (...args: unknown[]) => void;

/** Sends an event to Google Analytics, only if the visitor agreed and GA is loaded. */
export function track(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (!GA_ID || typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (gtag && readConsent() === "granted") gtag("event", name, params);
}
