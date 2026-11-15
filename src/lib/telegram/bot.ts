import { randomBytes } from "node:crypto";
import type { Alert, Watch, WatchStore } from "@/lib/watch/types";
import type { InlineButton, TgClient } from "./api";
import { escapeHtml } from "./api";
import { fill, langOf, strings, watchCard, type Lang } from "./text";

/** The slice of a Telegram update the bot understands. */
export interface TgUpdate {
  update_id?: number;
  message?: { message_id: number; text?: string; chat: { id: number; type?: string }; from?: { language_code?: string } };
  callback_query?: {
    id: string;
    data?: string;
    from?: { language_code?: string };
    message?: { message_id: number; chat: { id: number } };
  };
  my_chat_member?: { chat: { id: number }; new_chat_member?: { status?: string } };
}

export interface BotDeps {
  client: TgClient;
  store: WatchStore;
  /** Re-runs a watch and returns the new state; injected so the bot can be tested without providers. */
  check: (id: string) => Promise<{ watch: Watch; alerts: Alert[] } | null>;
  now?: () => number;
  /** Public URL of the web app, for "open on the website" links. */
  appUrl?: string;
}

const LINK_TTL_MS = 15 * 60_000;
const CHECK_COOLDOWN_MS = 60_000;
const LIST_LIMIT = 10;

/** Creates (or replaces) the one-time token behind the "Connect Telegram" link. */
export async function createTelegramLink(store: WatchStore, watchId: string, now = Date.now()): Promise<{ token: string; expiresAt: string } | null> {
  const token = randomBytes(18).toString("base64url");
  const expiresAt = new Date(now + LINK_TTL_MS).toISOString();
  const w = await store.update(watchId, { telegramLink: { token, expiresAt } });
  return w ? { token, expiresAt } : null;
}

/** Only chats that linked through the bot may see or change a watch. A chat id typed into a form proves nothing. */
export function ownedBy(w: Watch, chatId: number | string): boolean {
  return Boolean(w.notify.telegramVerified) && w.notify.telegramChatId === String(chatId);
}

/** Stops sending to this chat (blocked the bot, left the chat) and forgets the link. */
export async function unlinkChat(store: WatchStore, chatId: number | string): Promise<number> {
  let n = 0;
  for (const w of await store.list()) {
    if (w.notify.telegramChatId !== String(chatId)) continue;
    await store.update(w.id, { notify: { ...w.notify, telegramChatId: undefined, telegramVerified: undefined, telegramLang: undefined } });
    n++;
  }
  return n;
}

function keyboard(w: Watch, lang: Lang, appUrl?: string): InlineButton[][] {
  const s = strings(lang);
  const rows: InlineButton[][] = [
    [
      { text: `🔄 ${s.checkNow}`, callback_data: `c:${w.id}` },
      { text: w.active ? `⏸ ${s.pause}` : `▶️ ${s.resume}`, callback_data: `${w.active ? "p" : "r"}:${w.id}` },
    ],
    [{ text: `🗑 ${s.del}`, callback_data: `d:${w.id}` }],
  ];
  if (appUrl) rows.push([{ text: s.openSite, url: `${appUrl.replace(/\/$/, "")}/watches` }]);
  return rows;
}

/** Entry point: handle one Telegram update. Never throws; problems are logged. */
export async function handleUpdate(update: TgUpdate, deps: BotDeps): Promise<void> {
  try {
    if (update.my_chat_member) {
      const status = update.my_chat_member.new_chat_member?.status;
      if (status === "kicked" || status === "left") await unlinkChat(deps.store, update.my_chat_member.chat.id);
      return;
    }
    if (update.callback_query) return await onCallback(update.callback_query, deps);
    if (update.message?.text) return await onMessage(update.message, deps);
  } catch (e) {
    console.warn("[telegram] update failed", e);
  }
}

async function onMessage(msg: NonNullable<TgUpdate["message"]>, deps: BotDeps): Promise<void> {
  const chatId = msg.chat.id;
  const lang = langOf(msg.from?.language_code);
  const s = strings(lang);
  const [cmdRaw, ...rest] = (msg.text ?? "").trim().split(/\s+/);
  const cmd = cmdRaw.toLowerCase().replace(/@\w+$/, "");

  if (cmd === "/start") {
    const token = rest[0];
    if (!token) return void (await deps.client.sendMessage(chatId, escapeHtml(s.welcome)));
    return await linkWithToken(chatId, token, lang, deps);
  }
  if (cmd === "/help") return void (await deps.client.sendMessage(chatId, escapeHtml(s.help)));
  if (cmd === "/list" || cmd === "/watches") return await sendList(chatId, lang, deps);
  await deps.client.sendMessage(chatId, escapeHtml(s.unknown));
}

async function linkWithToken(chatId: number, token: string, lang: Lang, deps: BotDeps): Promise<void> {
  const s = strings(lang);
  const now = (deps.now ?? Date.now)();
  const hit = (await deps.store.list()).find((w) => w.telegramLink?.token === token && Date.parse(w.telegramLink.expiresAt) > now);
  if (!hit) return void (await deps.client.sendMessage(chatId, escapeHtml(s.badLink)));
  const updated = await deps.store.update(hit.id, {
    notify: { ...hit.notify, telegramChatId: String(chatId), telegramVerified: true, telegramLang: lang },
    telegramLink: undefined,
  });
  if (!updated) return void (await deps.client.sendMessage(chatId, escapeHtml(s.badLink)));
  await deps.client.sendMessage(chatId, `${escapeHtml(fill(s.linked, { label: updated.label }))}\n\n${watchCard(updated, lang)}`, { buttons: keyboard(updated, lang, deps.appUrl) });
}

async function sendList(chatId: number, lang: Lang, deps: BotDeps): Promise<void> {
  const s = strings(lang);
  const mine = (await deps.store.list()).filter((w) => ownedBy(w, chatId));
  if (!mine.length) return void (await deps.client.sendMessage(chatId, escapeHtml(s.none)));
  for (const w of mine.slice(0, LIST_LIMIT)) {
    await deps.client.sendMessage(chatId, watchCard(w, lang), { buttons: keyboard(w, lang, deps.appUrl) });
  }
  if (mine.length > LIST_LIMIT) await deps.client.sendMessage(chatId, escapeHtml(fill(s.more, { shown: LIST_LIMIT, total: mine.length })));
}

async function onCallback(cb: NonNullable<TgUpdate["callback_query"]>, deps: BotDeps): Promise<void> {
  const msg = cb.message;
  const lang = langOf(cb.from?.language_code);
  const s = strings(lang);
  const [action, id] = (cb.data ?? "").split(":");
  if (!msg || !id) return void (await deps.client.answerCallback(cb.id));
  const chatId = msg.chat.id;

  const w = await deps.store.get(id);
  if (!w) {
    await deps.client.answerCallback(cb.id, s.gone);
    return;
  }
  // The id comes from the button, but buttons can be forwarded: always re-check ownership.
  if (!ownedBy(w, chatId)) {
    await deps.client.answerCallback(cb.id, s.noAccess);
    return;
  }
  const show = async (next: Watch) => void (await deps.client.editMessage(chatId, msg.message_id, watchCard(next, lang), { buttons: keyboard(next, lang, deps.appUrl) }));

  switch (action) {
    case "p":
    case "r": {
      const next = await deps.store.update(id, { active: action === "r" });
      await deps.client.answerCallback(cb.id, action === "r" ? s.resumedToast : s.pausedToast);
      if (next) await show(next);
      return;
    }
    case "d":
      await deps.client.answerCallback(cb.id);
      await deps.client.editMessage(chatId, msg.message_id, escapeHtml(fill(s.delAsk, { label: w.label })), {
        buttons: [[{ text: `🗑 ${s.delYes}`, callback_data: `D:${id}` }, { text: s.delNo, callback_data: `n:${id}` }]],
      });
      return;
    case "D":
      await deps.store.delete(id);
      await deps.client.answerCallback(cb.id);
      await deps.client.editMessage(chatId, msg.message_id, escapeHtml(s.deleted));
      return;
    case "n":
      await deps.client.answerCallback(cb.id);
      await show(w);
      return;
    case "c": {
      const now = (deps.now ?? Date.now)();
      if (w.lastCheckedAt && now - Date.parse(w.lastCheckedAt) < CHECK_COOLDOWN_MS) {
        await deps.client.answerCallback(cb.id, s.checkedJust);
        await show(w);
        return;
      }
      await deps.client.answerCallback(cb.id, s.checking);
      const r = await deps.check(id).catch(() => null);
      if (!r) {
        await deps.client.sendMessage(chatId, escapeHtml(s.checkFailed));
        return;
      }
      await show(r.watch);
      // The check already notified the chat about alerts; only say something when there are none.
      if (!r.alerts.length) await deps.client.sendMessage(chatId, escapeHtml(s.noNews));
      return;
    }
    default:
      await deps.client.answerCallback(cb.id);
  }
}

