import { beforeEach, describe, expect, it } from "vitest";
import { MemoryWatchStore, setWatchStore } from "@/lib/watch/store";
import { createTelegramLink, handleUpdate, type BotDeps, type TgUpdate } from "@/lib/telegram/bot";
import type { SendOptions, TgClient } from "@/lib/telegram/api";
import { CLAIM_TTL_MS, consumeClaim, makeClaimToken, verifyClaimToken } from "@/lib/telegram/claim";
import { hashOwner, newOwnerToken, ownsWatch, withOwner } from "@/lib/watch/owner";
import { GET as claimRoute } from "@/app/watches/claim/route";
import { GET as list } from "@/app/api/watches/route";
import { publicWatch } from "@/lib/watch/public";

const SECRET = "test-secret-0123456789abcdef";
const request = { origin: "WAW", destination: "BCN", departDate: "2026-11-28", returnDate: "2026-11-29", adults: 1, children: 0, infants: 0, cabin: "economy" as const, currency: "EUR" };
const newWatch = (label: string, ownerHash?: string) => ({ label, currency: "EUR", ownerHash, params: { kind: "search" as const, request } });

describe("claim token", () => {
  it("round-trips and carries the chat id", () => {
    const t = makeClaimToken("42", SECRET, 1_000);
    expect(verifyClaimToken(t, SECRET, 2_000)?.chatId).toBe("42");
  });

  it("rejects tampering, a wrong secret and expiry", () => {
    const t = makeClaimToken("42", SECRET, 1_000);
    expect(verifyClaimToken(t, "another-secret-0123456789abcdef", 2_000)).toBeNull();
    const [payload, mac] = t.split(".");
    const forged = Buffer.from(Buffer.from(payload, "base64url").toString().replace(/^42/, "43")).toString("base64url");
    expect(verifyClaimToken(`${forged}.${mac}`, SECRET, 2_000)).toBeNull();
    expect(verifyClaimToken(t, SECRET, 1_000 + CLAIM_TTL_MS + 1)).toBeNull();
    expect(verifyClaimToken("nonsense", SECRET)).toBeNull();
    expect(verifyClaimToken("", SECRET)).toBeNull();
  });

  it("works once", () => {
    expect(consumeClaim("n-1", 1_000)).toBe(true);
    expect(consumeClaim("n-1", 2_000)).toBe(false);
  });
});

describe("several owner keys", () => {
  it("any stored key unlocks the tracker, other keys do not", async () => {
    const store = new MemoryWatchStore();
    const a = newOwnerToken();
    const b = newOwnerToken();
    const w = await store.create(newWatch("x", hashOwner(a)));
    expect(ownsWatch(w, a)).toBe(true);
    expect(ownsWatch(w, b)).toBe(false);
    const w2 = (await store.update(w.id, withOwner(w, b)))!;
    expect(ownsWatch(w2, a)).toBe(true);
    expect(ownsWatch(w2, b)).toBe(true);
    expect(ownsWatch(w2, newOwnerToken())).toBe(false);
    expect(ownsWatch(w2, null)).toBe(false);
  });

  it("caps the number of keys and never reveals them", async () => {
    const store = new MemoryWatchStore();
    let w = await store.create(newWatch("x", hashOwner(newOwnerToken())));
    const first = newOwnerToken();
    w = (await store.update(w.id, withOwner(w, first)))!;
    for (let i = 0; i < 25; i++) w = (await store.update(w.id, withOwner(w, newOwnerToken())))!;
    expect(w.ownerHashes!.length).toBeLessThanOrEqual(20);
    expect(ownsWatch(w, first)).toBe(false);
    expect(JSON.stringify(publicWatch(w))).not.toContain("ownerHash");
  });
});

describe("the bot and the claim link", () => {
  let store: MemoryWatchStore;
  let sent: { text?: string; opts?: SendOptions }[];
  let deps: BotDeps;
  const msg = (chat: number, text: string): TgUpdate => ({ message: { message_id: 1, chat: { id: chat }, text, from: { language_code: "uk" } } });
  const press = (chat: number, data: string): TgUpdate => ({ callback_query: { id: "cb", data, from: { language_code: "uk" }, message: { message_id: 7, chat: { id: chat } } } });
  const urlOf = () => sent.at(-1)?.opts?.buttons?.[0]?.[0] as { url?: string } | undefined;

  async function linkedWatch(chat: number, ownerHash?: string) {
    const w = await store.create(newWatch("WAW→BCN", ownerHash));
    const link = await createTelegramLink(store, w.id);
    await handleUpdate(msg(chat, `/start ${link!.token}`), deps);
    sent.length = 0;
    return w;
  }

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
    store = new MemoryWatchStore();
    setWatchStore(store);
    sent = [];
    const client: TgClient = {
      sendMessage: async (_c, text, opts) => (sent.push({ text, opts }), { ok: true }),
      editMessage: async () => ({ ok: true }),
      answerCallback: async () => ({ ok: true }),
    };
    deps = { client, store, check: async () => null, appUrl: "https://remeeet.com" };
  });

  it("/site and the button give a fresh signed link for a chat that owns trackers", async () => {
    const w = await linkedWatch(42);
    await handleUpdate(msg(42, "/site"), deps);
    expect(urlOf()?.url).toMatch(/^https:\/\/remeeet\.com\/watches\/claim\?c=/);
    expect(sent.at(-1)?.text).not.toContain("claim?c="); // not in the text, so link previews cannot use it up
    sent.length = 0;
    await handleUpdate(press(42, `o:${w.id}`), deps);
    expect(urlOf()?.url).toContain("/watches/claim?c=");
  });

  it("a chat without connected trackers gets no link", async () => {
    await handleUpdate(msg(7, "/site"), deps);
    expect(urlOf()?.url).toBeUndefined();
    expect(sent.at(-1)?.text).toContain("немає підключених");
  });

  it("opening the link in another browser unlocks the trackers of that chat, once", async () => {
    const laptop = newOwnerToken();
    const mine = await linkedWatch(42, hashOwner(laptop));
    const other = await store.create(newWatch("someone else's", hashOwner(newOwnerToken())));
    await handleUpdate(msg(42, "/site"), deps);
    const url = new URL(urlOf()!.url!);

    const res = await claimRoute(new Request(`http://x${url.pathname}${url.search}`));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/watches?claim=ok");
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    expect(cookie).toMatch(/^remeeet_owner=/);

    const seen = await (await list(new Request("http://x/api/watches", { headers: { cookie } }))).json();
    expect(seen.map((w: { id: string }) => w.id)).toEqual([mine.id]); // not the other person's tracker
    expect(ownsWatch((await store.get(other.id))!, cookie.split("=")[1])).toBe(false);
    expect(ownsWatch((await store.get(mine.id))!, laptop)).toBe(true); // the laptop keeps working

    const again = await claimRoute(new Request(`http://x${url.pathname}${url.search}`));
    expect(again.headers.get("location")).toBe("/watches?claim=bad");
    expect(again.headers.get("set-cookie")).toBeNull();
  });

  it("refuses garbage, expired and foreign links", async () => {
    await linkedWatch(42);
    for (const c of ["", "x.y", makeClaimToken("42", "another-secret-0123456789abcdef"), makeClaimToken("42", SECRET, Date.now() - 2 * CLAIM_TTL_MS)]) {
      const res = await claimRoute(new Request(`http://x/watches/claim?c=${encodeURIComponent(c)}`));
      expect(res.headers.get("location")).toBe("/watches?claim=bad");
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("keeps the endpoint closed when no secret is configured", async () => {
    await linkedWatch(42);
    const t = makeClaimToken("42", SECRET);
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await claimRoute(new Request(`http://x/watches/claim?c=${t}`));
    expect(res.headers.get("location")).toBe("/watches?claim=bad");
  });
});
