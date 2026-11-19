import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tgCall = vi.fn();
vi.mock("@/lib/telegram/api", () => ({
  botToken: () => "token",
  tgCall: (...a: unknown[]) => tgCall(...a),
  realClient: () => ({}),
  setupCommands: async () => {},
  ALLOWED_UPDATES: [],
}));
vi.mock("@/lib/watch/store", () => ({ watchStore: () => ({}) }));
vi.mock("@/lib/watch/checker", () => ({ checkWatch: async () => null }));

import { mayTakeOverBot } from "@/lib/telegram/polling";

describe("long polling guard", () => {
  beforeEach(() => {
    tgCall.mockReset();
    delete process.env.TELEGRAM_POLLING_TAKEOVER;
  });
  afterEach(() => {
    delete process.env.TELEGRAM_POLLING_TAKEOVER;
  });

  it("refuses when the bot has a webhook, naming the host but not the full URL", async () => {
    tgCall.mockResolvedValue({ ok: true, result: { url: "https://remeeet.com/api/telegram/webhook" } });
    const r = await mayTakeOverBot("token");
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain("remeeet.com");
    expect(JSON.stringify(r)).not.toContain("/api/telegram/webhook");
  });

  it("allows polling when there is no webhook", async () => {
    tgCall.mockResolvedValue({ ok: true, result: { url: "" } });
    expect(await mayTakeOverBot("token")).toEqual({ ok: true });
  });

  it("does not touch a webhook it cannot inspect", async () => {
    tgCall.mockResolvedValue({ ok: false });
    expect((await mayTakeOverBot("token")).ok).toBe(false);
  });

  it("can be told explicitly to take the bot over", async () => {
    process.env.TELEGRAM_POLLING_TAKEOVER = "1";
    expect(await mayTakeOverBot("token")).toEqual({ ok: true });
    expect(tgCall).not.toHaveBeenCalled();
  });
});
