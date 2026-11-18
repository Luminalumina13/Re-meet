"use client";

import Script from "next/script";
import { useEffect } from "react";
import { ADSENSE_CLIENT, GA_ID, trackingConfigured, useConsent } from "@/lib/consent";

type Gtag = (...args: unknown[]) => void;
type W = { gtag?: Gtag } & Record<string, unknown>;

/**
 * Nothing from Google is requested until the visitor presses "Accept". The tag then starts with Consent Mode v2
 * defaults denied and is immediately updated to granted; withdrawing consent switches GA off again.
 */
const start = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});gtag('consent','update',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});gtag('js',new Date());`;

export function Analytics() {
  const [consent] = useConsent();

  useEffect(() => {
    if (!GA_ID) return;
    const w = window as unknown as W;
    // Withdrawn after granting: stop measuring right away (the cookies are cleared by the browser settings).
    w[`ga-disable-${GA_ID}`] = consent !== "granted";
    if (consent === "denied" || consent === "unset") w.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" });
  }, [consent]);

  if (!trackingConfigured || consent !== "granted") return null;
  return (
    <>
      {GA_ID && (
        <>
          <Script id="gtag-init" strategy="afterInteractive">{`${start}gtag('config','${GA_ID}',{anonymize_ip:true});`}</Script>
          <Script id="gtag-lib" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        </>
      )}
      {ADSENSE_CLIENT && <Script id="adsense" strategy="afterInteractive" async crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`} />}
    </>
  );
}
