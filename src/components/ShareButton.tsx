"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/primitives";

/**
 * Copies a link to the current search (or opens the phone's share sheet). If the browser refuses
 * clipboard access, the link is shown in a field so it can be copied by hand.
 */
export function ShareButton({ path, query, disabled }: { path: string; query: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "copied">("idle");
  const [manual, setManual] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const share = async () => {
    const url = `${window.location.origin}${path}${query ? `?${query}` : ""}`;
    setManual(null);
    try {
      if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ url, title: "Re:meeet" });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      timer.current = setTimeout(() => setState("idle"), 2500);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // the user closed the share sheet
      setManual(url);
    }
  };

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <Button type="button" variant="ghost" size="lg" onClick={share} disabled={disabled} aria-live="polite">
        {state === "copied" ? <Check className="h-4 w-4 text-good" /> : <Link2 className="h-4 w-4" />}
        {state === "copied" ? t.share.copied : t.share.button}
      </Button>
      {manual && <input readOnly value={manual} onFocus={(e) => e.currentTarget.select()} className="h-9 w-72 max-w-full rounded-lg border border-border bg-surface px-2 text-xs" aria-label={t.share.button} />}
    </span>
  );
}
