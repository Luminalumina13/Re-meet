import { beforeEach, describe, expect, it, vi } from "vitest";

const tgCall = vi.fn();
vi.mock("@/lib/telegram/api", () => ({ escapeHtml: (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"), tgCall: (...a: unknown[]) => tgCall(...a) }));

import { formatError, redact, reportError, reportingEnabled, resetErrorReports, shouldReport } from "@/lib/errorReport";

// Fake values only: nothing here is a real token.
const FAKE_TOKEN = `100000001:${"A".repeat(35)}`;
const FAKE_TOKEN_2 = `100000002:${"B".repeat(35)}`;

const env = (o: Record<string, string>) => {
  for (const [k, v] of Object.entries(o)) vi.stubEnv(k, v);
};

beforeEach(() => {
  vi.unstubAllEnvs();
  tgCall.mockReset();
  tgCall.mockResolvedValue({ ok: true });
  resetErrorReports();
});

describe("redact", () => {
  it("hides bot tokens, keys, bearer tokens, e-mails and long opaque strings", () => {
    const out = redact(`fetch https://api.x/y?api_key=abc123&q=1 failed for a@b.co with Bearer sk-live-xyz and ${FAKE_TOKEN} token=hunter2 id ${"z".repeat(40)}`);
    expect(out).not.toMatch(/abc123|a@b\.co|sk-live|AAAAAAAAAA|hunter2|zzzzzzzzzz/);
    expect(out).toContain("q=1");
  });
});

describe("formatError", () => {
  it("names the place and the error, shortens, escapes HTML and drops absolute paths", () => {
    const e = new Error("bad <b>input</b> " + "x ".repeat(300));
    e.stack = "Error: bad\n    at run (/Users/someone/proj/src/lib/a.ts:1:2)\n    at go (/srv/app/.next/server/chunks/b.js:3:4)";
    const t = formatError("API 500", e, new Date("2026-11-20T12:34:56Z"));
    expect(t).toContain("API 500");
    expect(t).toContain("&lt;b&gt;input");
    expect(t).not.toContain("/Users/someone");
    expect(t).toContain("2026-11-20 12:34 UTC");
    expect(t.length).toBeLessThan(1500);
  });
});

describe("shouldReport", () => {
  it("collapses repeats for 15 minutes and caps the hourly total", () => {
    expect(shouldReport("a", 0)).toBe(true);
    expect(shouldReport("a", 60_000)).toBe(false);
    expect(shouldReport("a", 16 * 60_000)).toBe(true);
    resetErrorReports();
    for (let i = 0; i < 20; i++) expect(shouldReport(`e${i}`, 1_000)).toBe(true);
    expect(shouldReport("e-extra", 2_000)).toBe(false);
    expect(shouldReport("e-extra", 61 * 60_000)).toBe(true);
  });
});

describe("reportError", () => {
  const configured = { FEEDBACK_CHAT_ID: "-100123", TELEGRAM_BOT_TOKEN: FAKE_TOKEN };

  it("is off outside production unless asked, and can be switched off", () => {
    expect(reportingEnabled({ NODE_ENV: "test" } as NodeJS.ProcessEnv)).toBe(false);
    expect(reportingEnabled({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe(true);
    expect(reportingEnabled({ NODE_ENV: "test", ERROR_REPORTS: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(reportingEnabled({ NODE_ENV: "production", ERROR_REPORTS: "0" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("sends once to the feedback chat with the feedback bot", async () => {
    env({ ...configured, ERROR_REPORTS: "1", FEEDBACK_BOT_TOKEN: FAKE_TOKEN_2 });
    await reportError("API 500", new Error("boom"));
    await reportError("API 500", new Error("boom"));
    expect(tgCall).toHaveBeenCalledTimes(1);
    const [method, body, token] = tgCall.mock.calls[0];
    expect(method).toBe("sendMessage");
    expect(body.chat_id).toBe("-100123");
    expect(body.parse_mode).toBe("HTML");
    expect(token).toBe(FAKE_TOKEN_2);
  });

  it("does nothing when disabled or when no chat is configured, and never throws", async () => {
    await reportError("x", new Error("a")); // test env: off
    env({ ...configured, ERROR_REPORTS: "1", FEEDBACK_CHAT_ID: "" });
    await reportError("x", new Error("b"));
    expect(tgCall).not.toHaveBeenCalled();
    env({ ...configured, ERROR_REPORTS: "1" });
    tgCall.mockRejectedValue(new Error("telegram down"));
    await expect(reportError("x", new Error("c"))).resolves.toBeUndefined();
  });
});
