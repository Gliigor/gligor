"use client";

import { useState } from "react";
import { formatEuro } from "@/lib/format";
import { FieldShell, NumberInput } from "../fields";

/** From a payslip to a yearly gross wage: monthly wage × 12, plus holiday pay and a 13th month. */
export function SalaryHelper({ idPrefix, onApply }: { idPrefix: string; onApply: (yearly: number) => void }) {
  const [open, setOpen] = useState(false);
  const [monthly, setMonthly] = useState<number | null>(null);
  const [holiday, setHoliday] = useState<number | null>(8);
  const [thirteenth, setThirteenth] = useState(false);
  const yearly = monthly === null ? null : Math.round(monthly * 12 * (1 + (holiday ?? 0) / 100) + (thirteenth ? monthly : 0));

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs font-semibold text-ink-700 underline decoration-gold-500 underline-offset-4 hover:text-ink-900"
      >
        Rekenhulp: van loonstrook naar jaarloon
      </button>
    );
  }
  return (
    <div className="mt-2 space-y-3 rounded-sm border border-ink-200 bg-ink-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FieldShell id={`${idPrefix}-maandloon`} label="Bruto maandloon">
          <NumberInput id={`${idPrefix}-maandloon`} kind="money" value={monthly} onChange={setMonthly} />
        </FieldShell>
        <FieldShell id={`${idPrefix}-vakantiegeld`} label="Vakantiegeld">
          <NumberInput id={`${idPrefix}-vakantiegeld`} kind="percent" value={holiday} onChange={setHoliday} />
        </FieldShell>
      </div>
      <label className="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" className="h-4 w-4 accent-gold-500" checked={thirteenth} onChange={(e) => setThirteenth(e.target.checked)} />
        Dertiende maand
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-700 tabular">
          Jaarloon: <span className="font-semibold">{yearly === null ? "—" : formatEuro(yearly, { whole: true })}</span>
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="h-8 px-3 text-[13px] font-semibold text-ink-600 hover:text-ink-900">
            Sluiten
          </button>
          <button
            type="button"
            disabled={yearly === null}
            onClick={() => {
              if (yearly !== null) onApply(yearly);
              setOpen(false);
            }}
            className="h-8 rounded-sm bg-night px-3 text-[13px] font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
          >
            Overnemen
          </button>
        </div>
      </div>
    </div>
  );
}
