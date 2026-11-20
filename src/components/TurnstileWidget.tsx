"use client";

import { useEffect, useRef } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface Api {
  render: (el: HTMLElement, o: Record<string, unknown>) => string;
  remove: (id: string) => void;
}
const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Api> | null = null;

function load(): Promise<Api> {
  const w = window as unknown as { turnstile?: Api };
  if (w.turnstile) return Promise.resolve(w.turnstile);
  loading ??= new Promise<Api>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = () => (w.turnstile ? resolve(w.turnstile) : reject(new Error("turnstile")));
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare Turnstile widget. Reports a token via onToken, or null when it expires or fails. Renders nothing without a site key. */
export function TurnstileWidget({ onToken, theme }: { onToken: (t: string | null) => void; theme?: "light" | "dark" | "auto" }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return;
    let id: string | undefined;
    let gone = false;
    load()
      .then((api) => {
        if (gone || !box.current) return;
        id = api.render(box.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: theme ?? "auto",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      gone = true;
      if (id) (window as unknown as { turnstile?: Api }).turnstile?.remove(id);
    };
  }, [theme]);
  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
