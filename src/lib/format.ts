import type { Money } from "@/lib/domain/types";

export function fmtMoney(m: Money | { amount: number; currency: string }, locale = "uk-UA"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(m.amount);
}

export function fmtDate(iso: string, locale = "uk-UA", opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtDateTime(utcIso: string, locale = "uk-UA"): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(utcIso));
}

export function fmtDurationLocalized(min: number, h: string, m: string): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  if (hh === 0) return `${mm} ${m}`;
  if (mm === 0) return `${hh} ${h}`;
  return `${hh} ${h} ${mm} ${m}`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
