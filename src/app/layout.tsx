import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { Header } from "@/components/Header";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "cyrillic"], display: "swap" });

export const metadata: Metadata = {
  title: "re:meet — weekend flights & friend meetups",
  description: "Flight search tuned for weekends and for friends meeting from different cities.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f0f14" },
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
          <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-ink-3">re:meet · Kiwi.com · lastminute.com · Ryanair · Duffel</footer>
        </I18nProvider>
      </body>
    </html>
  );
}
