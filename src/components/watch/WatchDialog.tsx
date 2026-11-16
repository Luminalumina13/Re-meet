"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import type { WatchCreateInput } from "@/lib/api/schemas";
import type { Watch } from "@/lib/watch/types";
import { useI18n } from "@/lib/i18n";
import { postJson } from "@/lib/client";
import { TelegramConnect } from "./TelegramConnect";
import { Modal } from "@/components/ui/Modal";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { errorText } from "@/lib/errorText";

export function WatchDialog({
  open,
  onClose,
  params,
  defaultLabel,
  currentPrice,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  params: WatchCreateInput["params"];
  defaultLabel: string;
  currentPrice?: number;
  currency: string;
}) {
  const { t, locale } = useI18n();
  const [label, setLabel] = useState(defaultLabel);
  const [target, setTarget] = useState<string>(currentPrice ? String(Math.round(currentPrice * 0.85)) : "");
  const [drop, setDrop] = useState("0.05");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Watch | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: WatchCreateInput = {
        label,
        params,
        targetPrice: target ? Number(target) : undefined,
        dropThreshold: Number(drop),
      };
      setDone(await postJson<Watch>("/api/watches", body));
    } catch (e) {
      setErr(errorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t.common.track}>
      {done ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-good/15 text-good">
            <Check className="h-6 w-6" />
          </span>
          <p className="font-semibold">{t.watch.created}</p>
          {done.lastBestPrice !== undefined && (
            <p className="text-sm text-ink-2">
              {t.watch.best}: {new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(done.lastBestPrice)}
            </p>
          )}
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-xl border border-border p-4">
            <p className="text-sm text-ink-2">{t.watch.telegramPrompt}</p>
            <TelegramConnect watchId={done.id} connected={Boolean(done.notify.telegramVerified)} prominent />
          </div>
          <p className="max-w-sm text-xs text-ink-3">{t.watch.scheduleHint}</p>
          <Button variant="ghost" onClick={onClose}>
            {done.notify.telegramVerified ? "OK" : t.watch.telegramLater}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field label={t.watch.label}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t.watch.targetPrice} (${currency})`}>
              <Input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="—" />
            </Field>
            <Field label={t.watch.dropThreshold}>
              <Select value={drop} onChange={(e) => setDrop(e.target.value)}>
                {["0.03", "0.05", "0.1", "0.2"].map((v) => (
                  <option key={v} value={v}>
                    {Math.round(Number(v) * 100)} %
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-sm text-ink-2">
            <Send className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" /> {t.watch.telegramStep}
          </p>
          {err && <p className="text-sm text-critical">{err}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>
              {t.common.cancel}
            </Button>
            <Button variant="primary" onClick={submit} loading={busy} disabled={!label.trim()}>
              {t.watch.create}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
