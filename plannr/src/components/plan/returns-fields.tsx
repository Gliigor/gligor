"use client";

import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { RETURN_KEYS, type ReturnPercents } from "@/lib/plan/types";
import { FieldShell, NumberInput } from "./fields";

export const RETURN_LABELS: Record<(typeof RETURN_KEYS)[number], string> = {
  sparen: "Spaargeld",
  beleggingen: "Beleggingen",
  vastgoed: "Overig vastgoed (box 3)",
  bv: "Liquide middelen in de BV",
  woning: "Waardestijging eigen woning",
};

const PLANNR_DEFAULTS: Record<(typeof RETURN_KEYS)[number], number> = {
  sparen: ASSUMPTIONS.rvr.savings * 100,
  beleggingen: ASSUMPTIONS.rvr.investments * 100,
  vastgoed: ASSUMPTIONS.rvr.realEstate * 100,
  bv: ASSUMPTIONS.rvr.bv * 100,
  woning: ASSUMPTIONS.rvr.house * 100,
};

const nl = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });

/**
 * Five percentage fields for the realistic expected return per kind of wealth.
 * Empty fields fall back to `fallback` (firm defaults) and then Plannr's defaults,
 * shown as the placeholder.
 */
export function ReturnsFields({
  idPrefix,
  value,
  fallback,
  onChange,
}: {
  idPrefix: string;
  value: ReturnPercents;
  fallback?: ReturnPercents | null;
  onChange: (next: ReturnPercents) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RETURN_KEYS.map((k) => {
        const id = `${idPrefix}-${k}`;
        const placeholder = fallback?.[k] ?? PLANNR_DEFAULTS[k];
        return (
          <FieldShell key={k} id={id} label={RETURN_LABELS[k]}>
            <NumberInput
              id={id}
              kind="percent"
              value={value[k] ?? null}
              placeholder={nl.format(placeholder)}
              onChange={(v) => onChange({ ...value, [k]: v })}
            />
          </FieldShell>
        );
      })}
    </div>
  );
}
