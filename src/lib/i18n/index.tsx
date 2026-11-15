"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { uk, type Dict } from "./uk";
import { en } from "./en";
import { usePref } from "@/lib/prefs";

export type Lang = "uk" | "en";
const LANGS: readonly Lang[] = ["uk", "en"];
const DICTS: Record<Lang, Dict> = { uk, en };

interface Ctx {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  locale: string;
}

const I18nContext = createContext<Ctx>({ lang: "uk", t: uk, setLang: () => {}, locale: "uk-UA" });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = usePref<Lang>("lang", "uk", LANGS);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo<Ctx>(() => ({ lang, t: DICTS[lang], setLang, locale: lang === "uk" ? "uk-UA" : "en-GB" }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  return useContext(I18nContext);
}
