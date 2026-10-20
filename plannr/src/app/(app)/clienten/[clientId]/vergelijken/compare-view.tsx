"use client";

import Link from "next/link";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Check } from "@/components/ui/icons";
import { formatEuro, formatEuroCompact, formatPercent } from "@/lib/format";
import { bestColumn, SCENARIO_METRICS, type ScenarioColumn } from "@/lib/scenarios";

// Same validated palette as the other result charts.
const COLORS = ["#2B5FA3", "#C9871A", "#1D9B7C"];
const GRID = "#ECE7DC";
const AXIS = "#98938A";

export function CompareView({ clientId, columns }: { clientId: string; columns: ScenarioColumn[] }) {
  type Row = { label: string; value: (c: ScenarioColumn) => string };
  const rows: Row[] = [
    { label: "Pensioenleeftijd cliënt", value: (c) => (c.assumptions.retirementAge ? `${c.assumptions.retirementAge} jaar` : "—") },
    { label: "Pensioenleeftijd partner", value: (c) => (c.assumptions.partnerRetirementAge ? `${c.assumptions.partnerRetirementAge} jaar` : "—") },
    { label: "Vaste uitgaven per jaar", value: (c) => formatEuro(c.assumptions.expenses, { whole: true }) },
    {
      label: "Uitgavenpatroon (na pensioen / later)",
      value: (c) => `${Math.round(c.assumptions.retiredPct * 100)}% / ${Math.round(c.assumptions.laterPct * 100)}%`,
    },
    { label: "Verwacht rendement beleggingen", value: (c) => formatPercent(c.assumptions.investmentsReturn) },
    { label: "Posten met een periode", value: (c) => String(c.assumptions.items) },
  ];
  const assumptionRows = rows.filter((row) => columns.some((c) => row.value(c) !== row.value(columns[0])));

  const years = columns[0].points.map((p) => p.year);
  const series = (key: "neutraal" | "spending") =>
    years.map((year, i) => {
      const row: Record<string, number> = { year };
      columns.forEach((c) => (row[c.planId] = c.points[i]?.[key] ?? 0));
      return row;
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Uitkomsten naast elkaar" description="Elk plan volledig doorgerekend. Bedragen nominaal, tenzij anders vermeld." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm tabular">
            <thead>
              <tr className="border-b border-ink-900 text-left">
                <th className="px-4 py-3 font-medium text-ink-500 sm:px-5" />
                {columns.map((c, i) => (
                  <th key={c.planId} className="px-4 py-3 text-right font-semibold sm:px-5">
                    <span className="mr-1.5 inline-block h-0.5 w-3 align-middle" style={{ background: COLORS[i] }} />
                    <Link href={`/clienten/${clientId}/plannen/${c.planId}/resultaten`} className="hover:underline">
                      {c.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {SCENARIO_METRICS.map((m) => {
                const best = bestColumn(columns, m.key);
                return (
                  <tr key={m.key}>
                    <td className="px-4 py-2.5 text-ink-600 sm:px-5">{m.label}</td>
                    {columns.map((c, i) => {
                      const v = c.metrics[m.key];
                      return (
                        <td key={c.planId} className={cn("px-4 py-2.5 text-right sm:px-5", best === i && "font-semibold text-ink-900")}>
                          {m.kind === "year" ? (v ?? "niet") : v === null ? "—" : formatEuro(v, { whole: true })}
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
      </Card>

      {assumptionRows.length > 0 ? (
        <Card>
          <CardHeader title="Wat is er anders" description="Alleen de uitgangspunten die tussen de plannen verschillen." />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-ink-100">
              {assumptionRows.map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-2.5 text-ink-600 sm:px-5">{row.label}</td>
                  {columns.map((c) => (
                    <td key={c.planId} className="px-4 py-2.5 text-right tabular sm:px-5">
                      {row.value(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Vermogen (neutraal)" columns={columns} data={series("neutraal")} />
        <ChartCard title="Uitgaven per jaar" columns={columns} data={series("spending")} step />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  columns,
  data,
  step,
}: {
  title: string;
  columns: ScenarioColumn[];
  data: Record<string, number>[];
  step?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="px-2 pb-3 pt-4 sm:px-4">
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-600">
          {columns.map((c, i) => (
            <li key={c.planId} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: COLORS[i] }} />
              {c.title}
            </li>
          ))}
        </ul>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 11 }} minTickGap={28} />
            <YAxis tickFormatter={(v) => formatEuroCompact(Number(v))} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 11 }} width={70} />
            <Tooltip
              formatter={(v, name) => [formatEuro(Number(v), { whole: true }), columns.find((c) => c.planId === name)?.title ?? String(name)]}
              contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
            />
            {columns.map((c, i) => (
              <Line key={c.planId} type={step ? "stepAfter" : "monotone"} dataKey={c.planId} stroke={COLORS[i]} strokeWidth={2} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
