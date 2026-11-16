"use client";

import { Info } from "lucide-react";
import type { ProviderStatus } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/primitives";

export function ProviderBar({ providers, count, cached }: { providers: ProviderStatus[]; count: number; cached?: boolean }) {
  const { t } = useI18n();
  const demo = providers.some((p) => p.demo && p.status === "ok");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <span className="font-semibold text-ink-2 tabular-nums">
          {count} {t.common.results}
        </span>
        {cached && <Badge>{t.common.cached}</Badge>}
        <span>· {t.common.providers}:</span>
        {providers.map((p) => (
          <Badge key={p.id} tone={p.status === "ok" ? (p.demo ? "warn" : "good") : p.status === "error" ? "critical" : "neutral"} className="tabular-nums" >
            {p.demo ? t.common.demoData : p.name} {p.status === "ok" ? `${p.count} · ${p.ms} ms` : p.status === "error" ? t.errors.sourceDown : "—"}
          </Badge>
        ))}
      </div>
      {demo && (
        <div className="flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-ink-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
          {t.common.demoHint}
        </div>
      )}
    </div>
  );
}
