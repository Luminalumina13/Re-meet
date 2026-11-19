import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { adsenseMeta } from "@/lib/adsenseMeta";
import { Analytics } from "@/components/Analytics";
import { ExtraAirports } from "@/components/ExtraAirports";
import { ConsentBanner } from "@/components/ConsentBanner";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"], display: "swap" });

// Lets AdSense verify site ownership without loading any Google script (that only happens after consent, see Analytics.tsx).

// Browsers keep their own favicon cache, separate from HTTP caching: bump this when the icon files change so they fetch the new ones.
const ICON_VERSION = 2;

export const metadata: Metadata = {
  title: "Re:meeet — make time together last longer",
  description: "Flights for weekends and meet-ups: find a place and a time that works for everyone, wherever your people live.",
  icons: {
    icon: [
      { url: `/favicon.svg?v=${ICON_VERSION}`, type: "image/svg+xml" },
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "48x48" },
      { url: `/icon-192.png?v=${ICON_VERSION}`, sizes: "192x192", type: "image/png" },
    ],
    apple: `/apple-touch-icon.png?v=${ICON_VERSION}`,
  },
  ...adsenseMeta(process.env.NEXT_PUBLIC_ADSENSE_CLIENT),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t)}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={`${manrope.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
          <ConsentBanner />
          <Analytics />
          <ExtraAirports />
        </I18nProvider>
      </body>
    </html>
  );
}
