"use client";

import Link from "next/link";
import { useState } from "react";
import { howto } from "@/content/howto";
import { errorText } from "@/lib/errorText";
import { postJson } from "@/lib/client";
import { useI18n } from "@/lib/i18n";
import { TURNSTILE_SITE_KEY, TurnstileWidget } from "@/components/TurnstileWidget";
import { Button } from "@/components/ui/primitives";

const field = "w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:outline-2 focus-visible:outline-accent";

/** "Still have a question?" form. The message goes to the owner's Telegram; nothing is kept on the server. */
export function FeedbackForm() {
  const { lang, t } = useI18n();
  const f = howto[lang].form;
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await postJson("/api/feedback", { message, contact: contact || undefined, lang, website, turnstile: token ?? undefined });
      setState("done");
      setMessage("");
      setContact("");
    } catch (err) {
      setError(errorText(err, t));
      setState("idle");
      setToken(null);
      setWidgetKey((k) => k + 1); // a token works once: ask for a fresh one
    }
  }

  return (
    <section id="ask" className="mt-12 rounded-2xl border border-border bg-surface p-5">
      <h2 className="text-xl font-bold text-ink">{f.title}</h2>
      <p className="mt-1 text-ink-2">{f.lead}</p>
      {state === "done" ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p role="status" className="font-semibold text-good">
            {f.thanks}
          </p>
          <Button variant="secondary" onClick={() => setState("idle")}>
            {f.again}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {f.message}
            <textarea className={`${field} min-h-28`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={f.messagePlaceholder} required minLength={5} maxLength={1500} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {f.contact}
            <input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder={f.contactPlaceholder} maxLength={120} autoComplete="off" />
            <span className="text-xs font-normal text-ink-3">{f.contactHint}</span>
          </label>
          {/* Honeypot: hidden from people and from assistive tech, tempting for bots. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>
          <TurnstileWidget key={widgetKey} onToken={setToken} />
          <p className="text-xs text-ink-3">
            {f.consent}{" "}
            <Link href="/privacy" className="font-semibold underline hover:text-accent-text">
              {t.legal.privacy}
            </Link>
          </p>
          {error && <p role="alert" className="rounded-xl border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">{error}</p>}
          <div>
            <Button type="submit" variant="primary" loading={state === "sending"} disabled={Boolean(TURNSTILE_SITE_KEY) && !token}>
              {state === "sending" ? f.sending : f.send}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
