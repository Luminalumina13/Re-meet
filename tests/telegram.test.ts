import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryWatchStore } from "@/lib/watch/store";
import type { Alert, Watch } from "@/lib/watch/types";
import { createTelegramLink, handleUpdate, ownedBy, type BotDeps, type TgUpdate } from "@/lib/telegram/bot";
import type { SendOptions, TgClient } from "@/lib/telegram/api";
import { alertText, langOf } from "@/lib/telegram/text";
import { publicWatch } from "@/lib/watch/public";

interface Sent {
  kind: "send" | "edit" | "answer";
  chat?: number | string;
  text?: string;
  opts?: SendOptions;
}

function fakeClient() {
  const sent: Sent[] = [];
  const client: TgClient = {
    sendMessage: async (chat, text, opts) => (sent.push({ kind: "send", chat, text, opts }), { ok: true }),
    editMessage: async (chat, _id, text, opts) => (sent.push({ kind: "edit", chat, text, opts }), { ok: true }),
    answerCallback: async (_id, text) => (sent.push({ kind: "answer", text }), { ok: true }),
  };
  return { client, sent };
}

const request = { origin: "WAW", destination: "BCN", departDate: "2026-11-28", returnDate: "2026-11-29", adults: 1, children: 0, infants: 0, cabin: "economy" as const, currency: "EUR" };
const newWatch = (label: string) => ({ label, currency: "EUR", params: { kind: "search" as const, request } });

let store: MemoryWatchStore;
let sent: Sent[];
let deps: BotDeps;
let check: ReturnType<typeof vi.fn<BotDeps["check"]>>;
const NOW = Date.parse("2026-11-15T12:00:00Z");

beforeEach(() => {
  store = new MemoryWatchStore();
  const f = fakeClient();
  sent = f.sent;
  check = vi.fn<BotDeps["check"]>(async (id: string) => {
    const watch = (await store.get(id))!;
    return { watch, alerts: [] as Alert[] };
  });
  deps = { client: f.client, store, check, now: () => NOW };
});

const msg = (chat: number, text: string, lang = "uk"): TgUpdate => ({ message: { message_id: 1, chat: { id: chat }, text, from: { language_code: lang } } });
const press = (chat: number, data: string): TgUpdate => ({ callback_query: { id: "cb", data, from: { language_code: "uk" }, message: { message_id: 7, chat: { id: chat } } } });

async function linked(label: string, chat: number) {
  const w = await store.create(newWatch(label));
  const link = await createTelegramLink(store, w.id, NOW);
  await handleUpdate(msg(chat, `/start ${link!.token}`), deps);
  sent.length = 0;
  return (await store.get(w.id))!;
}

describe("linking", () => {
  it("connects the chat through a one-time token and consumes it", async () => {
    const w = await store.create(newWatch("WAW-BCN"));
    const link = (await createTelegramLink(store, w.id, NOW))!;
    await handleUpdate(msg(42, `/start ${link.token}`), deps);
    const after = (await store.get(w.id))!;
    expect(after.notify).toMatchObject({ telegramChatId: "42", telegramVerified: true, telegramLang: "uk" });
    expect(after.telegramLink).toBeUndefined();
    expect(sent[0].text).toContain("Підключено");

    sent.length = 0;
    await handleUpdate(msg(99, `/start ${link.token}`), deps); // replay from another chat
    expect(sent[0].text).toContain("недійсне");
    expect((await store.get(w.id))!.notify.telegramChatId).toBe("42");
  });

  it("rejects expired and unknown tokens", async () => {
    const w = await store.create(newWatch("x"));
    const link = (await createTelegramLink(store, w.id, NOW - 20 * 60_000))!; // expired 5 min ago
    await handleUpdate(msg(1, `/start ${link.token}`), deps);
    await handleUpdate(msg(1, "/start nonsense"), deps);
    expect(sent.every((s) => /недійсне/.test(s.text ?? ""))).toBe(true);
    expect((await store.get(w.id))!.notify.telegramChatId).toBeUndefined();
  });

  it("greets without a token and answers in English for English users", async () => {
    await handleUpdate(msg(1, "/start", "en"), deps);
    expect(sent[0].text).toContain("Hi!");
  });
});

describe("ownership", () => {
  it("lists only watches this chat linked through the bot", async () => {
    await linked("mine", 1);
    await linked("theirs", 2);
    // A chat id typed into a form notifies, but proves nothing.
    const spoof = await store.create({ ...newWatch("spoofed"), notify: { telegramChatId: "1" } });
    expect(ownedBy(spoof, 1)).toBe(false);

    await handleUpdate(msg(1, "/list"), deps);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain("mine");
    expect(sent.some((s) => /theirs|spoofed/.test(s.text ?? ""))).toBe(false);
  });

  it("says so when there is nothing to show", async () => {
    await handleUpdate(msg(5, "/list"), deps);
    expect(sent[0].text).toContain("немає підключених");
  });

  it("refuses buttons from a chat that does not own the watch", async () => {
    const w = await linked("mine", 1);
    await handleUpdate(press(2, `p:${w.id}`), deps);
    await handleUpdate(press(2, `D:${w.id}`), deps);
    expect(sent.every((s) => s.kind === "answer")).toBe(true);
    const still = (await store.get(w.id))!;
    expect(still.active).toBe(true);
  });

  it("unlinks when the user blocks the bot", async () => {
    const w = await linked("mine", 1);
    await handleUpdate({ my_chat_member: { chat: { id: 1 }, new_chat_member: { status: "kicked" } } }, deps);
    const after = (await store.get(w.id))!;
    expect(after.notify.telegramChatId).toBeUndefined();
    expect(after.notify.telegramVerified).toBeUndefined();
  });
});

describe("buttons", () => {
  it("pauses and resumes", async () => {
    const w = await linked("mine", 1);
    await handleUpdate(press(1, `p:${w.id}`), deps);
    expect((await store.get(w.id))!.active).toBe(false);
    expect(sent.find((s) => s.kind === "edit")!.text).toContain("На паузі");
    await handleUpdate(press(1, `r:${w.id}`), deps);
    expect((await store.get(w.id))!.active).toBe(true);
  });

  it("deletes only after confirmation", async () => {
    const w = await linked("mine", 1);
    await handleUpdate(press(1, `d:${w.id}`), deps);
    expect(await store.get(w.id)).toBeDefined();
    expect(sent.find((s) => s.kind === "edit")!.opts!.buttons![0].map((b) => b.callback_data)).toEqual([`D:${w.id}`, `n:${w.id}`]);
    await handleUpdate(press(1, `D:${w.id}`), deps);
    expect(await store.get(w.id)).toBeUndefined();
  });

  it("checks now, but not more than once a minute", async () => {
    const w = await linked("mine", 1);
    await handleUpdate(press(1, `c:${w.id}`), deps);
    expect(check).toHaveBeenCalledTimes(1);
    expect(sent.some((s) => s.kind === "send" && /Нових подій немає/.test(s.text ?? ""))).toBe(true);

    await store.update(w.id, { lastCheckedAt: new Date(NOW - 10_000).toISOString() });
    await handleUpdate(press(1, `c:${w.id}`), deps);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("copes with a deleted watch and a failing check", async () => {
    await handleUpdate(press(1, "p:missing"), deps);
    expect(sent[0]).toMatchObject({ kind: "answer", text: expect.stringContaining("немає") });
    const w = await linked("mine", 1);
    check.mockRejectedValueOnce(new Error("providers down"));
    await handleUpdate(press(1, `c:${w.id}`), deps);
    expect(sent.some((s) => /Не вдалося/.test(s.text ?? ""))).toBe(true);
  });
});

describe("legal commands", () => {
  it("send the document links when the site URL is known", async () => {
    await handleUpdate(msg(1, "/privacy"), { ...deps, appUrl: "https://remeeet.example/" });
    await handleUpdate(msg(1, "/terms"), { ...deps, appUrl: "https://remeeet.example" });
    expect(sent[0].text).toContain("https://remeeet.example/privacy");
    expect(sent[1].text).toContain("https://remeeet.example/terms");
    expect(sent[0].opts?.buttons?.[0][0].url).toBe("https://remeeet.example/privacy");
  });

  it("point to the website footer otherwise, and the welcome mentions both", async () => {
    await handleUpdate(msg(1, "/terms"), deps);
    expect(sent[0].text).toContain("внизу сторінки");
    sent.length = 0;
    await handleUpdate(msg(1, "/start"), deps);
    expect(sent[0].text).toContain("/terms");
    expect(sent[0].text).toContain("/privacy");
  });
});

describe("texts", () => {
  it("escapes HTML in labels", async () => {
    const w = await store.create(newWatch("<b>&</b>"));
    const link = (await createTelegramLink(store, w.id, NOW))!;
    await handleUpdate(msg(3, `/start ${link.token}`), deps);
    expect(sent[0].text).not.toContain("<b>&</b>");
    expect(sent[0].text).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("picks the language and localises alerts", () => {
    expect(langOf("uk")).toBe("uk");
    expect(langOf("ru")).toBe("uk");
    expect(langOf(undefined)).toBe("uk");
    expect(langOf("de")).toBe("en");
    const w = { currency: "EUR", targetPrice: 100 } as Watch;
    const drop: Alert = { id: "a", at: "", type: "price_drop", message: "Price dropped", price: 90, previousPrice: 120 };
    expect(alertText(drop, w, "uk")).toBe("📉 Ціна впала на 25 %: 120 EUR → 90 EUR");
    expect(alertText(drop, w, "en")).toBe("Price dropped");
  });
});

describe("API privacy", () => {
  it("never exposes link tokens or chat ids", async () => {
    const w = await linked("mine", 1);
    const link = (await createTelegramLink(store, w.id, NOW))!;
    const pub = publicWatch((await store.get(w.id))!);
    const json = JSON.stringify(pub);
    expect(json).not.toContain(link.token);
    expect(pub.notify.telegramChatId).toBeUndefined();
    expect(pub.notify.telegramVerified).toBe(true);
  });
});

describe("webhook route", () => {
  it("stays closed without a secret and rejects wrong ones", async () => {
    const { POST } = await import("@/app/api/telegram/webhook/route");
    const req = (secret?: string) => new Request("http://x/api/telegram/webhook", { method: "POST", body: "{}", headers: secret ? { "x-telegram-bot-api-secret-token": secret } : {} });
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123456:abc");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "");
    expect((await POST(req("anything"))).status).toBe(503);
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "right-secret-1234567");
    expect((await POST(req())).status).toBe(403);
    expect((await POST(req("wrong-secret-1234567"))).status).toBe(403);
    vi.unstubAllEnvs();
  });
});
