"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/primitives";

/**
 * "Connect Telegram" for one watch. It asks the server for a one-time t.me link and shows it as a
 * plain link (opening a window after an async call would be blocked by popup blockers).
 */
export function TelegramConnect({ watchId, connected, onChanged, prominent = false }: { watchId: string; connected: boolean; onChanged?: () => void; prominent?: boolean }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setErr(null);
    try {
      setUrl((await api<{ url: string }>(`/api/watches/${watchId}/telegram`, { method: "POST" })).url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/watches/${watchId}/telegram`, { method: "DELETE" });
      setUrl(null);
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  };

  if (connected) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-ink-2">
        <Check className="h-3.5 w-3.5 text-good" /> {t.watch.telegramConnected}
        <button type="button" className="font-semibold text-ink-3 underline hover:text-ink" onClick={disconnect} disabled={busy}>
          {t.watch.telegramDisconnect}
        </button>
      </span>
    );
  }
  return (
    <span className={prominent ? "flex flex-col items-center gap-2" : "inline-flex flex-wrap items-center gap-2"}>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className={prominent ? "inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover" : "inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-ink hover:bg-accent-hover"}>
          <Send className="h-3.5 w-3.5" /> {t.watch.telegramOpen}
        </a>
      ) : (
        <Button size={prominent ? "md" : "sm"} variant={prominent ? "primary" : "ghost"} loading={busy} onClick={connect}>
          <Send className="h-3.5 w-3.5" /> {t.watch.telegramConnect}
        </Button>
      )}
      {url && <span className="text-xs text-ink-3">{t.watch.telegramLinkHint}</span>}
      {err && <span className="text-xs text-critical">{err}</span>}
    </span>
  );
}
