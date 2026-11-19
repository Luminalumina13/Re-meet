import type { Watch } from "./types";

/** What the HTTP API may reveal: no link tokens, and no Telegram chat ids (only whether Telegram is connected). */
export function publicWatch(w: Watch): Watch {
  const { telegramLink: _link, ownerHash: _owner, ownerHashes: _owners, ...rest } = w;
  void _link;
  void _owner;
  void _owners;
  const { telegramChatId: _chat, telegramLang: _lang, ...notify } = w.notify;
  void _chat;
  void _lang;
  return { ...rest, notify };
}
