"use client";

import { Card, CardHeader } from "@/components/ui/card";
import type { PlanInputs, ReturnPercents } from "@/lib/plan/types";
import { FieldShell, NumberInput } from "../fields";
import { ReturnsFields } from "../returns-fields";

/** Per-plan assumptions: spending per life phase and the realistic expected returns. */
export function AssumptionsCard({
  inputs,
  firmReturns,
  onChange,
  show = "all",
}: {
  inputs: PlanInputs;
  firmReturns?: ReturnPercents | null;
  onChange: (next: PlanInputs) => void;
  /** The Uitgaven step shows the spending pattern, the Vermogen step the expected returns. */
  show?: "all" | "pattern" | "returns";
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

  return (
    <Card>
      <CardHeader
        title={
          show === "pattern"
            ? "Uitgaven per levensfase"
            : show === "returns"
              ? "Verwacht rendement"
              : "Uitgangspunten voor de projectie"
        }
        description={
          show === "pattern"
            ? "Hoe de uitgaven veranderen na het pensioen en op latere leeftijd. Leeg laten: de grijze standaardwaarde."
            : show === "returns"
              ? "Realistisch verwacht rendement (RVR) per soort vermogen. Leeg laten: de grijze standaardwaarde."
              : "Uitgavenpatroon per levensfase en het realistisch verwacht rendement (RVR). Leeg laten: de grijze standaardwaarde."
        }
      />
      <div className="space-y-6 p-4 sm:p-5">
        {show !== "returns" ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-ink-800">
              Uitgavenpatroon
            </h4>
            <p className="text-xs text-ink-500">
              De vaste uitgaven van het huishouden als percentage van nu. Veel
              planners rekenen met 90% na pensioen en 75% op latere leeftijd.
            </p>
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
              <FieldShell
                id="patroon-leeftijd"
                label="Latere fase vanaf leeftijd"
              >
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
          </div>
        ) : null}
        {show !== "pattern" ? (
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-ink-800">
              Realistisch verwacht rendement per jaar
            </h4>
            <p className="text-xs text-ink-500">
              Het neutrale scenario rekent hiermee; het pessimistische en
              optimistische scenario liggen daar een vaste marge onder en boven.
            </p>
            <ReturnsFields
              idPrefix="plan-rvr"
              value={u.rendement}
              fallback={firmReturns}
              onChange={(rendement) =>
                onChange({ ...inputs, uitgangspunten: { ...u, rendement } })
              }
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
