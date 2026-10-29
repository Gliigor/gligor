"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { EXPENSE_CATEGORIES, EXPENSE_GROUPS, expenseTotal, groupTotal, usesCategories, type ExpenseKey } from "@/lib/plan/expenses";
import type { PlanInputs } from "@/lib/plan/types";
import { formatEuro } from "@/lib/format";
import { FieldShell, NumberInput } from "../fields";

/**
 * Household expenses: one total, or per category (same categories as the
 * downloadable expense sheet). With categories the yearly total is their sum.
 */
export function ExpensesCard({
  inputs,
  missing,
  fromDocument,
  onChange,
}: {
  inputs: PlanInputs;
  missing: boolean;
  fromDocument: boolean;
  onChange: (next: PlanInputs) => void;
}) {
  const [mode, setMode] = useState<"totaal" | "categorie">(usesCategories(inputs.uitgaven) ? "categorie" : "totaal");
  const [perMonth, setPerMonth] = useState(true);
  const factor = perMonth ? 12 : 1;
  const total = usesCategories(inputs.uitgaven) ? expenseTotal(inputs.uitgaven) : (inputs.prive.jaarlijkse_uitgaven ?? null);

  const setCategory = (key: ExpenseKey, shown: number | null) => {
    const uitgaven = { ...inputs.uitgaven, [key]: shown === null ? null : Math.round(shown * factor) };
    const next = { ...inputs, uitgaven };
    onChange(
      usesCategories(uitgaven)
        ? { ...next, prive: { ...inputs.prive, jaarlijkse_uitgaven: expenseTotal(uitgaven) }, fromDocument: inputs.fromDocument.filter((k) => k !== "jaarlijkse_uitgaven") }
        : next,
    );
  };

  const chooseMode = (next: "totaal" | "categorie") => {
    if (next === "totaal" && usesCategories(inputs.uitgaven)) {
      if (!confirm("Terug naar één totaalbedrag? De bedragen per categorie worden gewist; het totaal blijft staan.")) return;
      onChange({ ...inputs, uitgaven: {} });
    }
    setMode(next);
  };

  const toggle = (value: string, current: string, set: (v: never) => void, options: [string, string][]) => (
    <div className="flex overflow-hidden rounded-sm border border-ink-200">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={current === key}
          onClick={() => set(key as never)}
          className={cn("h-8 px-3 text-[13px] font-semibold", current === key ? "bg-night text-white" : "bg-white text-ink-700 hover:bg-ink-50")}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader
        title="Uitgaven van het huishouden"
        description="Inclusief woonlasten (huur of hypotheek). Gebruik eventueel de uitgavensheet bij Downloads om de cliënt het zelf te laten invullen."
        action={toggle("", mode, chooseMode, [
          ["totaal", "Totaal"],
          ["categorie", "Per categorie"],
        ])}
      />
      <div className="space-y-5 p-4 sm:p-5">
        {mode === "totaal" && !usesCategories(inputs.uitgaven) ? (
          <div className="max-w-sm">
            <FieldShell id="input-jaarlijkse_uitgaven" label="Totale uitgaven per jaar" missing={missing} fromDocument={fromDocument}>
              <NumberInput
                id="input-jaarlijkse_uitgaven"
                kind="money"
                value={inputs.prive.jaarlijkse_uitgaven ?? null}
                missing={missing}
                fromDocument={fromDocument}
                onChange={(v) =>
                  onChange({
                    ...inputs,
                    prive: { ...inputs.prive, jaarlijkse_uitgaven: v },
                    fromDocument: inputs.fromDocument.filter((k) => k !== "jaarlijkse_uitgaven"),
                  })
                }
              />
            </FieldShell>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-600">
                Bedragen invullen
              </p>
              {toggle("", perMonth ? "maand" : "jaar", (v: string) => setPerMonth(v === "maand"), [
                ["maand", "Per maand"],
                ["jaar", "Per jaar"],
              ])}
            </div>
            {EXPENSE_GROUPS.map((g) => (
              <div key={g.key} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2 border-b border-ink-100 pb-1">
                  <h4 className="text-sm font-semibold text-ink-800">{g.label}</h4>
                  <span className="text-xs text-ink-500 tabular">{formatEuro(groupTotal(inputs.uitgaven, g.key), { whole: true })} per jaar</span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {EXPENSE_CATEGORIES.filter((c) => c.group === g.key).map((c) => {
                    const yearly = inputs.uitgaven[c.key];
                    const shown = typeof yearly === "number" ? Math.round(yearly / factor) : null;
                    return (
                      <FieldShell key={c.key} id={`uitgaven-${c.key}`} label={c.label} help={c.items.join(", ")}>
                        <NumberInput id={`uitgaven-${c.key}`} kind="money" value={shown} onChange={(v) => setCategory(c.key, v)} />
                      </FieldShell>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
        <div
          className={cn(
            "flex items-baseline justify-between gap-3 border-t border-ink-200 pt-3",
            missing && total === null ? "text-warn-600" : "text-ink-900",
          )}
        >
          <span className="text-sm font-semibold">Totaal per jaar</span>
          <span className="font-display text-xl font-semibold tabular">{total === null ? "—" : formatEuro(total, { whole: true })}</span>
        </div>
        {total !== null ? <p className="-mt-3 text-right text-xs text-ink-500 tabular">{formatEuro(total / 12, { whole: true })} per maand</p> : null}
      </div>
    </Card>
  );
}
