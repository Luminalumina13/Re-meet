"use client";

import Link from "next/link";
import { CircleHelp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cx } from "@/lib/format";

/** A quiet link to the matching step of the "How it works" page (anchors are the step ids in content/howto.ts). */
export function HowLink({ step, label, className }: { step: string; label?: "results" | "watchCreate"; className?: string }) {
  const { t } = useI18n();
  return (
    <Link href={`/how-it-works#${step}`} className={cx("inline-flex items-center gap-1 text-xs text-ink-3 underline-offset-2 transition hover:text-accent-text hover:underline", className)}>
      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      {label ? t.howLink[label] : t.howLink.general}
    </Link>
  );
}
