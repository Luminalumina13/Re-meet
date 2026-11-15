import type { Alert, Watch } from "@/lib/watch/types";
import { describeWatch } from "@/lib/watch/describe";
import { escapeHtml } from "./api";

export type Lang = "uk" | "en";

/** Ukrainian-first: Ukrainian, Russian and unknown language codes get Ukrainian, everything else English. */
export function langOf(code?: string): Lang {
  if (!code) return "uk";
  const c = code.toLowerCase();
  return c.startsWith("uk") || c.startsWith("ru") ? "uk" : "en";
}

const T = {
  uk: {
    welcome:
      "Привіт! Я стежу за цінами на квитки з Re:meeet і пишу, коли ціна падає або з'являються нові пропозиції.\n\nЩоб підключити відстеження, створіть його на сайті й натисніть «Підключити Telegram». Мої відстеження: /list",
    help:
      "Як це працює:\n1. На сайті натисніть «Відстежувати» біля пошуку, плану зустрічі чи напрямку.\n2. На сторінці «Відстеження» натисніть «Підключити Telegram» і відкрийте посилання.\n3. Я надсилатиму повідомлення про зміни ціни.\n\n/list — ваші відстеження з кнопками: перевірити зараз, пауза, видалити.",
    linked: "Підключено! Надсилатиму сповіщення про «{label}».",
    badLink: "Посилання недійсне або застаріло. Створіть нове на сторінці «Відстеження» на сайті.",
    none: "У вас ще немає підключених відстежень. Створіть його на сайті й натисніть «Підключити Telegram».",
    more: "Показано {shown} із {total}. Решту дивіться на сайті.",
    price: "Найкраща ціна",
    was: "було",
    target: "Ціль",
    checked: "Перевірено",
    never: "ще не перевірялось",
    paused: "На паузі",
    active: "Активне",
    checkNow: "Перевірити зараз",
    pause: "Пауза",
    resume: "Відновити",
    del: "Видалити",
    delAsk: "Видалити відстеження «{label}»? Це не можна скасувати.",
    delYes: "Так, видалити",
    delNo: "Скасувати",
    deleted: "Видалено.",
    checking: "Перевіряю…",
    checkedJust: "Щойно перевірено",
    gone: "Цього відстеження вже немає.",
    noAccess: "Це відстеження не підключене до цього чату.",
    checkFailed: "Не вдалося перевірити. Спробуйте пізніше.",
    noNews: "Нових подій немає.",
    openSite: "Відкрити на сайті",
    unknown: "Не розумію. Спробуйте /list або /help.",
    pausedToast: "На паузі",
    resumedToast: "Відновлено",
  },
  en: {
    welcome:
      "Hi! I watch flight prices for Re:meeet and message you when a price drops or new offers appear.\n\nCreate a tracker on the website and press “Connect Telegram”. Your trackers: /list",
    help:
      "How it works:\n1. On the website press “Track” next to a search, a meetup plan or a destination.\n2. On the “Price tracking” page press “Connect Telegram” and open the link.\n3. I will message you when the price changes.\n\n/list — your trackers with buttons: check now, pause, delete.",
    linked: "Connected! I will send alerts for “{label}”.",
    badLink: "This link is invalid or has expired. Create a new one on the Price tracking page.",
    none: "You have no connected trackers yet. Create one on the website and press “Connect Telegram”.",
    more: "Showing {shown} of {total}. See the rest on the website.",
    price: "Best price",
    was: "was",
    target: "Target",
    checked: "Checked",
    never: "not checked yet",
    paused: "Paused",
    active: "Active",
    checkNow: "Check now",
    pause: "Pause",
    resume: "Resume",
    del: "Delete",
    delAsk: "Delete the tracker “{label}”? This cannot be undone.",
    delYes: "Yes, delete",
    delNo: "Cancel",
    deleted: "Deleted.",
    checking: "Checking…",
    checkedJust: "Just checked",
    gone: "This tracker no longer exists.",
    noAccess: "This tracker is not connected to this chat.",
    checkFailed: "Could not check. Try again later.",
    noNews: "No new events.",
    openSite: "Open on the website",
    unknown: "I did not get that. Try /list or /help.",
    pausedToast: "Paused",
    resumedToast: "Resumed",
  },
} as const;

export type Strings = (typeof T)[Lang];
export const strings = (lang: Lang): Strings => T[lang];
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

const money = (n: number, cur: string) => `${Math.round(n * 100) / 100} ${cur}`;

/** Card text for a watch (HTML). */
export function watchCard(w: Watch, lang: Lang): string {
  const s = strings(lang);
  const prev = w.history.length > 1 ? w.history[w.history.length - 2].bestPrice : undefined;
  const lines = [`<b>${escapeHtml(w.label)}</b>`, escapeHtml(describeWatch(w))];
  lines.push(
    `${s.price}: <b>${w.lastBestPrice !== undefined ? money(w.lastBestPrice, w.currency) : "—"}</b>` +
      (prev !== undefined && w.lastBestPrice !== undefined && prev !== w.lastBestPrice ? ` (${s.was} ${money(prev, w.currency)})` : ""),
  );
  if (w.targetPrice !== undefined) lines.push(`${s.target}: ${money(w.targetPrice, w.currency)}`);
  lines.push(`${s.checked}: ${w.lastCheckedAt ? w.lastCheckedAt.slice(0, 16).replace("T", " ") + " UTC" : s.never}`);
  lines.push(w.active ? s.active : `⏸ ${s.paused}`);
  return lines.join("\n");
}

/** Localised alert line; falls back to the stored English message. */
export function alertText(a: Alert, w: Watch, lang: Lang): string {
  const cur = w.currency;
  if (lang === "en") return a.message;
  switch (a.type) {
    case "price_drop":
    case "price_rise": {
      if (a.price === undefined || a.previousPrice === undefined || a.previousPrice <= 0) return a.message;
      const pct = Math.round((Math.abs(a.price - a.previousPrice) / a.previousPrice) * 100);
      return `${a.type === "price_drop" ? "📉 Ціна впала" : "📈 Ціна зросла"} на ${pct} %: ${money(a.previousPrice, cur)} → ${money(a.price, cur)}`;
    }
    case "target_reached":
      return a.price !== undefined && w.targetPrice !== undefined ? `🎯 Досягнуто цільову ціну: ${money(a.price, cur)} (ціль ${money(w.targetPrice, cur)})` : a.message;
    case "new_offer":
      return a.count !== undefined ? `✨ Нові пропозиції: ${a.count}${a.total !== undefined ? ` (усього ${a.total})` : ""}` : a.message;
    case "no_results":
      return "Пропозицій за цим запитом більше немає.";
  }
}
