"use client";

import { TURNSTILE_SITE_KEY, loadTurnstile } from "@/components/TurnstileWidget";

/**
 * The search endpoints ask for proof that a person is searching (code "human_check"). This runs Cloudflare Turnstile
 * without showing anything; only if Cloudflare wants an interaction a small box appears at the bottom of the screen.
 * The token is exchanged at /api/human for a cookie that lasts an hour. Parallel requests share one check.
 */
let pending: Promise<void> | null = null;

export function ensureHuman(): Promise<void> {
  pending ??= run().finally(() => {
    pending = null;
  });
  return pending;
}

async function run(): Promise<void> {
  if (!TURNSTILE_SITE_KEY) throw new Error("turnstile");
  const api = await loadTurnstile();
  const en = document.documentElement.lang.startsWith("en");
  const box = document.createElement("div");
  box.setAttribute("role", "dialog");
  box.style.cssText =
    "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:60;display:none;flex-direction:column;gap:8px;padding:12px;border-radius:16px;background:var(--surface,#fff);color:var(--text,#111);box-shadow:0 10px 30px rgba(0,0,0,.25);font:600 13px/1.3 system-ui,sans-serif;max-width:calc(100vw - 32px)";
  const label = document.createElement("div");
  label.textContent = en ? "Quick check that you are not a robot" : "Коротка перевірка, що ви не робот";
  const slot = document.createElement("div");
  box.append(label, slot);
  document.body.appendChild(box);
  let id: string | undefined;
  try {
    const token = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("turnstile")), 120_000);
      id = api.render(slot, {
        sitekey: TURNSTILE_SITE_KEY,
        appearance: "interaction-only",
        theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
        language: en ? "en" : "uk",
        "before-interactive-callback": () => (box.style.display = "flex"),
        callback: (t: string) => {
          clearTimeout(timer);
          resolve(t);
        },
        "error-callback": () => {
          clearTimeout(timer);
          reject(new Error("turnstile"));
        },
      });
    });
    const res = await fetch("/api/human", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    if (!res.ok) throw new Error("human");
  } finally {
    if (id) api.remove(id);
    box.remove();
  }
}
