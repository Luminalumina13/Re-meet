import type { Alert, Watch } from "./types";

export interface AlertTexts {
  drop: string;
  rise: string;
  target: string;
  newOffers: string;
  gone: string;
}

const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/**
 * The alert in the visitor's language. Alerts are stored with an English message (it also goes to Telegram), so the
 * page builds its own text from the structured fields and falls back to the stored message when one is missing.
 */
export function alertText(a: Alert, w: Pick<Watch, "currency" | "targetPrice">, m: AlertTexts): string {
  const cur = w.currency;
  const { price, previousPrice: prev } = a;
  if ((a.type === "price_drop" || a.type === "price_rise") && price !== undefined && prev) {
    const pct = Math.round((Math.abs(price - prev) / prev) * 100);
    return fill(a.type === "price_drop" ? m.drop : m.rise, { pct, prev, price, cur });
  }
  if (a.type === "target_reached" && price !== undefined && w.targetPrice !== undefined) return fill(m.target, { price, target: w.targetPrice, cur });
  if (a.type === "new_offer" && a.count !== undefined && a.total !== undefined) return fill(m.newOffers, { count: a.count, total: a.total });
  if (a.type === "no_results") return m.gone;
  return a.message;
}
