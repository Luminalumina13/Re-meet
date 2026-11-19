import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchPage } from "@/components/search/SearchPage";
import { siteUrl } from "./sitemap";

// Structured data for search engines: the brand, the site and the app.
const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Re:meeet",
    url: siteUrl,
    logo: `${siteUrl}/icon-512.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Re:meeet",
    alternateName: ["Remeeet", "Re:meet"],
    url: siteUrl,
    inLanguage: ["uk", "en"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Re:meeet",
    url: siteUrl,
    applicationCategory: "TravelApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
    description: "Weekend flights, meet-up planner for friends in different cities, flexible dates and price tracking.",
  },
];

// Child pages replace (not merge) openGraph/alternates, so the home page states its own canonical address.
export const metadata: Metadata = { alternates: { canonical: "/" }, openGraph: { url: "/", siteName: "Re:meeet", type: "website" } };

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <Suspense>
        <SearchPage />
      </Suspense>
    </>
  );
}
