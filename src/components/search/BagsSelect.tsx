"use client";

import type { Bags, Baggage } from "@/lib/domain/types";
import { wantsBags } from "@/lib/domain/types";
import { useI18n } from "@/lib/i18n";
import { Field, Select } from "@/components/ui/primitives";

type Choice = "none" | "cabin" | "checked" | "both";
const CHOICES: Choice[] = ["none", "cabin", "checked", "both"];

export function bagsChoice(b?: Bags): Choice {
  const cabin = (b?.cabin ?? 0) > 0;
  const checked = (b?.checked ?? 0) > 0;
  return cabin && checked ? "both" : cabin ? "cabin" : checked ? "checked" : "none";
}

export function choiceBags(c: string): Bags | undefined {
  if (c === "cabin") return { cabin: 1 };
  if (c === "checked") return { checked: 1 };
  if (c === "both") return { cabin: 1, checked: 1 };
  return undefined;
}

/** Bags per traveller; sources that can price them quote fares with them. */
export function BagsSelect({ value, onChange, className }: { value?: Bags; onChange: (b: Bags | undefined) => void; className?: string }) {
  const { t } = useI18n();
  return (
    <Field label={t.bags.label}>
      <Select value={bagsChoice(value)} onChange={(e) => onChange(choiceBags(e.target.value))} className={className ?? "w-56"} title={t.bags.hint}>
        {CHOICES.map((c) => (
          <option key={c} value={c}>
            {t.bags[c]}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** "with cabin bag" / "no bags" next to a price, only when bags were asked for. */
export function bagsLabel(t: ReturnType<typeof useI18n>["t"], asked: Bags | undefined, baggage: Baggage | undefined): string | null {
  if (!wantsBags(asked)) return null;
  if (!baggage) return t.bags.noBags;
  if (baggage.cabinBag > 0 && baggage.checkedBag > 0) return t.bags.withBoth;
  if (baggage.checkedBag > 0) return t.bags.withChecked;
  if (baggage.cabinBag > 0) return t.bags.withCabin;
  return t.bags.noBags;
}
