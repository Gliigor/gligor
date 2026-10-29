"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Check, Loader2, Sparkles } from "@/components/ui/icons";
import { compareChoices } from "@/lib/actions/compare";
import { COMPARISONS, METRIC_LABELS, type ComparisonKind, type ComparisonOutcome, type ComparisonParams } from "@/lib/compare";
import { formatEuro, formatEuroCompact } from "@/lib/format";
import { NumberInput } from "./fields";

// Same validated palette as the other result charts.
const COLORS = ["#2B5FA3", "#C9871A", "#1D9B7C"];

export function ChoicesPanel({ planId, withBv }: { planId: string; withBv: boolean }) {
  const choices = COMPARISONS.filter((c) => withBv || !c.bv);
  const [kind, setKind] = useState<ComparisonKind>(choices[0].kind);
  const [outcomes, setOutcomes] = useState<Partial<Record<ComparisonKind, ComparisonOutcome>>>({});
  const [params, setParams] = useState<Partial<Record<ComparisonKind, ComparisonParams>>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function run(k: ComparisonKind, p: ComparisonParams | null) {
    startTransition(async () => {
      try {
        const res = await compareChoices(planId, k, p);
        setOutcomes((o) => ({ ...o, [k]: res }));
        setParams((cur) => ({ ...cur, [k]: cur[k] ?? res.params }));
        setError(null);
      } catch {
        setError("De vergelijking kon niet worden berekend.");
      }
    });
  }

  useEffect(() => {
    if (!outcomes[kind]) run(kind, params[kind] ?? null);
    // Only when switching tabs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function setParam(patch: ComparisonParams) {
    const next = { ...(params[kind] ?? {}), ...patch };
    setParams((cur) => ({ ...cur, [kind]: next }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(kind, next), 600);
  }

  const outcome = outcomes[kind];
  const meta = COMPARISONS.find((c) => c.kind === kind)!;
  const p = params[kind] ?? outcome?.params ?? {};

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-500" /> Keuzes vergelijken
          </span>
        }
        description="Vergelijk scenario's naast elkaar. Elke variant is volledig doorgerekend met dezelfde rekenkern."
        action={pending ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" /> : null}
      />
      <div className="border-b border-ink-100 px-3 sm:px-5">
        <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
          {choices.map((c) => (
            <button
              key={c.kind}
              role="tab"
              aria-selected={c.kind === kind}
              onClick={() => setKind(c.kind)}
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-3 text-[13px] font-semibold transition-colors",
                c.kind === kind ? "border-gold-500 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <p className="font-display text-lg text-ink-800">{meta.question}</p>

        {kind === "aflossen" ? (
          <ParamRow label="Bedrag om af te lossen uit spaargeld">
            <NumberInput id="param-repay" kind="money" value={p.repayAmount ?? null} onChange={(v) => setParam({ repayAmount: v ?? 0 })} />
          </ParamRow>
        ) : null}
        {kind === "salaris_dividend" ? (
          <ParamRow label="Voorgesteld DGA-salaris (bruto per jaar)" hint="Het verschil met het huidige salaris wordt na vennootschapsbelasting als dividend uitgekeerd.">
            <NumberInput id="param-salary" kind="money" value={p.salary ?? null} onChange={(v) => setParam({ salary: v ?? 0 })} />
          </ParamRow>
        ) : null}
        {kind === "schenken" ? (
          <ParamRow label="Aantal jaren jaarlijks vrijgesteld schenken">
            <NumberInput id="param-years" kind="integer" value={p.giftYears ?? null} onChange={(v) => setParam({ giftYears: v ?? 1 })} />
          </ParamRow>
        ) : null}

        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        {!outcome ? (
          <p className="text-sm text-ink-500">Bezig met doorrekenen…</p>
        ) : !outcome.available ? (
          <p className="rounded-sm border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">{outcome.reason}</p>
        ) : (
          <Outcome outcome={outcome} />
        )}
      </div>
    </Card>
  );
}

function ParamRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_14rem] sm:items-center">
      <div>
        <div className="text-[13px] font-medium text-ink-700">{label}</div>
        {hint ? <div className="text-xs text-ink-500">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Outcome({ outcome }: { outcome: ComparisonOutcome }) {
  const v = outcome.variants;
  const value = (m: ComparisonOutcome["metrics"][number], i: number) => v[i][m] as number | null;
  const bestIndex = (m: ComparisonOutcome["metrics"][number]) => {
    const dir = METRIC_LABELS[m].better;
    if (dir === "none" || v.length < 2) return -1;
    const vals = v.map((_, i) => value(m, i) ?? 0);
    const target = dir === "high" ? Math.max(...vals) : Math.min(...vals);
    if (vals.every((x) => Math.abs(x - target) < 1)) return -1;
    return vals.indexOf(target);
  };

  const chartData = v[0].points.map((pt, i) => {
    const row: Record<string, number> = { year: pt.year };
    v.forEach((variant) => (row[variant.key] = variant.points[i]?.value ?? 0));
    return row;
  });

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular">
          <thead>
            <tr className="border-b border-ink-900 text-left">
              <th className="py-2 pr-3 font-medium text-ink-500" />
              {v.map((variant, i) => (
                <th key={variant.key} className="px-3 py-2 text-right font-semibold">
                  <span className="mr-1.5 inline-block h-0.5 w-3 align-middle" style={{ background: COLORS[i] }} />
                  {variant.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {outcome.metrics.map((m) => {
              const best = bestIndex(m);
              return (
                <tr key={m}>
                  <td className="py-2.5 pr-3 text-ink-600">{METRIC_LABELS[m].label}</td>
                  {v.map((variant, i) => {
                    const val = value(m, i);
                    return (
                      <td key={variant.key} className={cn("px-3 py-2.5 text-right", best === i && "font-semibold text-ink-900")}>
                        {m === "depletedYear" ? (val ?? "niet") : formatEuro(val ?? 0, { whole: true })}
                        {best === i ? <Check className="ml-1 inline h-3.5 w-3.5 text-gold-500" aria-label="beste" /> : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#ECE7DC" />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: "#ECE7DC" }} tick={{ fill: "#98938A", fontSize: 11 }} minTickGap={28} />
            <YAxis tickFormatter={(x) => formatEuroCompact(Number(x))} tickLine={false} axisLine={false} tick={{ fill: "#98938A", fontSize: 11 }} width={70} />
            <Tooltip
              formatter={(x, name) => [formatEuro(Number(x), { whole: true }), v.find((variant) => variant.key === name)?.label ?? String(name)]}
              contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
            />
            {v.map((variant, i) => (
              <Line key={variant.key} type="monotone" dataKey={variant.key} stroke={COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="border-l-2 border-gold-500 bg-ink-50 px-4 py-3 text-[14px] leading-relaxed text-ink-800">{outcome.conclusion}</div>
      <p className="text-xs text-ink-400">
        Neutraal scenario, nominaal, {v[0].points[0]?.year}–{outcome.endYear}. Indicatief: geen advies.
      </p>
    </div>
  );
}
