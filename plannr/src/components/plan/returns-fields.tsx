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

/** Plannr's default inflation in percent (average Dutch CPI inflation). */
export const DEFAULT_INFLATION_PCT = ASSUMPTIONS.inflation * 100;

/** Inflation that applies: plan, then firm, then Plannr's default (percent). */
export function inflationPct(plan?: ReturnPercents | null, firm?: ReturnPercents | null): number {
  return plan?.inflatie ?? firm?.inflatie ?? DEFAULT_INFLATION_PCT;
}

export const formatPct = (v: number) => `${nl.format(v)}%`;

/** One percentage field for the yearly inflation; empty falls back like the returns. */
export function InflationField({
  id,
  value,
  fallback,
  onChange,
}: {
  id: string;
  value: ReturnPercents;
  fallback?: ReturnPercents | null;
  onChange: (next: ReturnPercents) => void;
}) {
  return (
    <FieldShell id={id} label="Inflatie per jaar" help="Gemiddelde inflatie in Nederland (CPI, CBS) over de afgelopen 25 jaar: ongeveer 2,3%.">
      <NumberInput
        id={id}
        kind="percent"
        value={value.inflatie ?? null}
        placeholder={nl.format(fallback?.inflatie ?? DEFAULT_INFLATION_PCT)}
        onChange={(v) => onChange({ ...value, inflatie: v })}
      />
    </FieldShell>
  );
}

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
  withBv = true,
}: {
  idPrefix: string;
  value: ReturnPercents;
  fallback?: ReturnPercents | null;
  onChange: (next: ReturnPercents) => void;
  /** Show the return on BV cash (only for clients with a company). */
  withBv?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RETURN_KEYS.filter((k) => withBv || k !== "bv").map((k) => {
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
