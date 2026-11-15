import type { ReactNode } from "react";
import { cx } from "@/lib/format";
import { Button, Spinner } from "./primitives";

/**
 * Primary submit button whose label changes while it works ("Search" → "Searching…").
 * Both labels are laid out in the same grid cell, so the button keeps the width of the longer one
 * and nothing around it jumps when the search starts.
 */
export function SubmitButton({ icon, idle, busy, loading, disabled }: { icon: ReactNode; idle: string; busy: string; loading: boolean; disabled?: boolean }) {
  const layer = "col-start-1 row-start-1 inline-flex items-center justify-center gap-2 whitespace-nowrap";
  return (
    <Button type="submit" variant="primary" size="lg" disabled={disabled || loading} aria-busy={loading}>
      <span className="inline-grid">
        <span className={cx(layer, loading && "invisible")}>
          {icon}
          {idle}
        </span>
        <span className={cx(layer, !loading && "invisible")} aria-hidden={!loading}>
          <Spinner />
          {busy}
        </span>
      </span>
    </Button>
  );
}
