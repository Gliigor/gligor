"use client";

import { Card, CardHeader } from "@/components/ui/card";
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
    <>
      <Card>
        <CardHeader
          title="Inflatie"
          description="Alle bedragen vul je in geld van nu in. Uitgaven, inkomens, pensioenen en de AOW stijgen elk jaar met de inflatie; rendementen zijn daar niet voor gecorrigeerd."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
          <InflationField id="plan-inflatie" value={u.rendement} fallback={firmReturns} onChange={setRates} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Uitgaven per levensfase"
          description="De vaste uitgaven van het huishouden als percentage van nu. Veel planners rekenen met 90% na pensioen en 75% op latere leeftijd."
        />
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
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
      </Card>

      <Card>
        <CardHeader
          title="Verwacht rendement"
          description="Realistisch verwacht rendement (RVR) per soort vermogen, per jaar. Het neutrale scenario rekent hiermee; het pessimistische en optimistische scenario liggen daar een vaste marge onder en boven."
        />
        <div className="p-4 sm:p-5">
          <ReturnsFields idPrefix="plan-rvr" value={u.rendement} fallback={firmReturns} onChange={setRates} withBv={withBv} />
        </div>
      </Card>
    </>
  );
}
