/** Thin Telegram Bot API client. Never logs the token. */

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface SendOptions {
  buttons?: InlineButton[][];
  disablePreview?: boolean;
}

export interface TgResponse<T = unknown> {
  ok: boolean;
  result?: T;
  errorCode?: number;
  description?: string;
}

/** What the bot needs from Telegram; the tests substitute a fake. */
export interface TgClient {
  sendMessage(chatId: string | number, html: string, opts?: SendOptions): Promise<TgResponse>;
  editMessage(chatId: string | number, messageId: number, html: string, opts?: SendOptions): Promise<TgResponse>;
  answerCallback(callbackId: string, text?: string): Promise<TgResponse>;
}

export function botToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.TELEGRAM_BOT_TOKEN?.trim() || undefined;
}

export async function tgCall<T = unknown>(method: string, params: Record<string, unknown>, token = botToken(), timeoutMs = 15_000): Promise<TgResponse<T>> {
  if (!token) return { ok: false, description: "TELEGRAM_BOT_TOKEN is not set" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
    return { ok: Boolean(body.ok), result: body.result, errorCode: body.error_code ?? (res.ok ? undefined : res.status), description: body.description };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : String(e) };
  }
}

const markup = (o?: SendOptions) => (o?.buttons?.length ? { reply_markup: { inline_keyboard: o.buttons } } : {});

export function realClient(token = botToken()): TgClient {
  return {
    sendMessage: (chatId, html, o) =>
      tgCall("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: o?.disablePreview ?? true }, ...markup(o) }, token),
    editMessage: (chatId, messageId, html, o) =>
      tgCall("editMessageText", { chat_id: chatId, message_id: messageId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...markup(o) }, token),
    answerCallback: (callbackId, text) => tgCall("answerCallbackQuery", { callback_query_id: callbackId, text }, token),
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let cachedUsername: string | undefined;
/** The bot's @username (needed for t.me deep links). Asks Telegram once. */
export async function botUsername(): Promise<string | undefined> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (cachedUsername) return cachedUsername;
  const me = await tgCall<{ username?: string }>("getMe", {});
  cachedUsername = me.result?.username;
  return cachedUsername;
}

export const BOT_COMMANDS = {
  uk: [
    { command: "list", description: "Мої відстеження" },
    { command: "help", description: "Як це працює" },
    { command: "terms", description: "Умови користування" },
    { command: "privacy", description: "Політика конфіденційності" },
  ],
  en: [
    { command: "list", description: "My trackers" },
    { command: "help", description: "How it works" },
    { command: "terms", description: "Terms of Use" },
    { command: "privacy", description: "Privacy Policy" },
  ],
};

export const ALLOWED_UPDATES = ["message", "callback_query", "my_chat_member"];

/** Registers the command menu (idempotent). */
export async function setupCommands(token = botToken()): Promise<void> {
  await tgCall("setMyCommands", { commands: BOT_COMMANDS.uk }, token);
  await tgCall("setMyCommands", { commands: BOT_COMMANDS.en, language_code: "en" }, token);
}
