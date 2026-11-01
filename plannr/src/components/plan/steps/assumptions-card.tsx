"use client";

import type { PlanInputs, ReturnPercents } from "@/lib/plan/types";
import { FieldShell, NumberInput } from "../fields";
import { InflationField, ReturnsFields } from "../returns-fields";

/** Per-plan assumptions (Uitgangspunten step): inflation, spending per life phase and the realistic expected returns. */
export function AssumptionsCards({
  inputs,
  firmReturns,
  onChange,
  withBv,
}: {
  inputs: PlanInputs;
  firmReturns?: ReturnPercents | null;
  onChange: (next: PlanInputs) => void;
  /** Show the return on BV cash (only for clients with a company). */
  withBv: boolean;
}) {
  const u = inputs.uitgangspunten;
  const setPattern = (patch: Partial<typeof u.uitgavenpatroon>) =>
    onChange({
      ...inputs,
      uitgangspunten: {
        ...u,
        uitgavenpatroon: { ...u.uitgavenpatroon, ...patch },
      },
    });
  const setRates = (rendement: ReturnPercents) => onChange({ ...inputs, uitgangspunten: { ...u, rendement } });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-ink-900">Inflatie</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InflationField id="plan-inflatie" value={u.rendement} fallback={firmReturns} onChange={setRates} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-ink-900">Uitgaven per levensfase</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <FieldShell id="patroon-pensioen" label="Na pensioen">
            <NumberInput
              id="patroon-pensioen"
              kind="percent"
              value={u.uitgavenpatroon.pensioenPct}
              placeholder="100"
              onChange={(v) => setPattern({ pensioenPct: v })}
            />
          </FieldShell>
          <FieldShell id="patroon-leeftijd" label="Latere fase vanaf leeftijd">
            <NumberInput
              id="patroon-leeftijd"
              kind="integer"
              value={u.uitgavenpatroon.laterLeeftijd}
              placeholder="75"
              onChange={(v) => setPattern({ laterLeeftijd: v })}
            />
          </FieldShell>
          <FieldShell id="patroon-later" label="In de latere fase">
            <NumberInput
              id="patroon-later"
              kind="percent"
              value={u.uitgavenpatroon.laterPct}
              placeholder={String(u.uitgavenpatroon.pensioenPct ?? 100)}
              onChange={(v) => setPattern({ laterPct: v })}
            />
          </FieldShell>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-[1.35rem] font-semibold text-ink-900">Verwacht rendement</h2>
        <div>
          <ReturnsFields idPrefix="plan-rvr" value={u.rendement} fallback={firmReturns} onChange={setRates} withBv={withBv} />
        </div>
      </section>
    </div>
  );
}
