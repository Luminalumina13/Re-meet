"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { usePref } from "@/lib/prefs";
import { useI18n } from "@/lib/i18n";
import { cx } from "@/lib/format";

/** The three "e" of Re:meeet are the brand's extra time together: violet, lilac, amber. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("font-extrabold tracking-tight", className)} aria-label="Re:meeet">
      Re<span style={{ color: "var(--e1)" }}>:</span>m<span style={{ color: "var(--e1)" }}>e</span>
      <span style={{ color: "var(--e2)" }}>e</span>
      <span style={{ color: "var(--e3)" }}>e</span>t
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      {/* Two routes meeting in the middle */}
      <svg width="30" height="28" viewBox="0 0 30 28" aria-hidden>
        <circle cx="11" cy="14" r="8" fill="var(--e1)" fillOpacity="0.92" />
        <circle cx="19" cy="14" r="8" fill="var(--e2)" fillOpacity="0.92" />
        <path d="M15 7.3a8 8 0 0 1 0 13.4a8 8 0 0 1 0-13.4z" fill="var(--e3)" />
      </svg>
      <Wordmark className="text-xl" />
    </span>
  );
}

export function Header() {
  const { t, lang, setLang } = useI18n();
  const path = usePathname();
  const [saved, setSaved] = usePref<"light" | "dark">("theme", "light", ["light", "dark"]);
  // When nothing is saved the inline script picked the OS theme; read what it applied.
  const applied = useSyncExternalStore(
    () => () => {},
    () => (document.documentElement.getAttribute("data-theme") as "light" | "dark" | null) ?? saved,
    () => "light" as const,
  );
  const theme = applied;

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    setSaved(next);
  };

  const links = [
    { href: "/", label: t.nav.search },
    { href: "/explore", label: t.nav.explore },
    { href: "/meetup", label: t.nav.meetup },
    { href: "/watches", label: t.nav.watches },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="order-last flex w-full items-center justify-center gap-1 rounded-xl bg-surface-2/70 p-1 sm:order-none sm:w-auto">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cx(
                "whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-semibold transition sm:px-3",
                path === l.href ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLang(lang === "uk" ? "en" : "uk")}
            className="h-8 rounded-lg px-2 text-[12px] font-bold text-ink-2 hover:bg-surface-2"
            aria-label="Language"
          >
            {lang === "uk" ? t.lang.en : t.lang.uk}
          </button>
          <button type="button" onClick={toggleTheme} className="h-8 w-8 rounded-lg text-ink-2 hover:bg-surface-2 inline-flex items-center justify-center" aria-label={theme === "dark" ? t.theme.light : t.theme.dark}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
