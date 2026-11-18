import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/feedback/route";
import { allowFeedback, feedbackConfig, formatFeedback, resetFeedbackLimits } from "@/lib/feedback";

const post = (body: unknown, ip = "1.2.3.4") =>
  new Request("http://x/api/feedback", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) });

describe("feedback form", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    resetFeedbackLimits();
    fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("FEEDBACK_BOT_TOKEN", "123:test-token");
    vi.stubEnv("FEEDBACK_CHAT_ID", "42");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is configured only with a token and a numeric chat id", () => {
    expect(feedbackConfig({ FEEDBACK_BOT_TOKEN: "t", FEEDBACK_CHAT_ID: "42" } as unknown as NodeJS.ProcessEnv)).toEqual({ token: "t", chatId: "42" });
    expect(feedbackConfig({ FEEDBACK_BOT_TOKEN: "t" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(feedbackConfig({ FEEDBACK_BOT_TOKEN: "t", FEEDBACK_CHAT_ID: "@name" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(feedbackConfig({ TELEGRAM_BOT_TOKEN: "t", FEEDBACK_CHAT_ID: "-100123" } as unknown as NodeJS.ProcessEnv)).toEqual({ token: "t", chatId: "-100123" });
  });

  it("delivers a question to Telegram, escaped, and returns 201", async () => {
    const res = await POST(post({ message: "Як <b>працює</b> відстеження?", contact: "@maria", lang: "uk", website: "" }));
    expect(res.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bot123:test-token/sendMessage");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.chat_id).toBe("42");
    expect(sent.text).toContain("&lt;b&gt;працює&lt;/b&gt;");
    expect(sent.text).toContain("@maria");
  });

  it("says so when no contact was left", () => {
    expect(formatFeedback({ message: "hello there" })).toContain("Контакт не вказано");
  });

  it("rejects empty and oversized messages", async () => {
    expect((await POST(post({ message: "hi" }))).status).toBe(400);
    expect((await POST(post({ message: "x".repeat(1501) }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pretends success but sends nothing when the honeypot is filled", async () => {
    const res = await POST(post({ message: "buy cheap pills now", website: "http://spam" }));
    expect(res.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("limits one client to 3 messages per window, but not others", async () => {
    for (let i = 0; i < 3; i++) expect((await POST(post({ message: `question number ${i}` }))).status).toBe(201);
    const blocked = await POST(post({ message: "question number 4" }));
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("rate_limited");
    expect((await POST(post({ message: "question from another" }, "5.6.7.8"))).status).toBe(201);
  });

  it("allows the client again after the window", () => {
    const t0 = Date.now();
    for (let i = 0; i < 3; i++) expect(allowFeedback("c", t0)).toBe(true);
    expect(allowFeedback("c", t0 + 1000)).toBe(false);
    expect(allowFeedback("c", t0 + 11 * 60_000)).toBe(true);
  });

  it("is unavailable when not configured, and when Telegram refuses", async () => {
    vi.stubEnv("FEEDBACK_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect((await POST(post({ message: "is anyone there" }))).status).toBe(503);
    vi.stubEnv("FEEDBACK_BOT_TOKEN", "123:test-token");
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ ok: false, error_code: 403, description: "blocked" }), { status: 403 }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await POST(post({ message: "is anyone there" }, "9.9.9.9"))).status).toBe(502);
  });
});
