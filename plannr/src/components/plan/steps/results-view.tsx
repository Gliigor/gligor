"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/card";
import { AlertTriangle } from "@/components/ui/icons";
import type { PlanResult } from "@/lib/engine/types";
import { formatEuro, formatEuroCompact, formatPercent } from "@/lib/format";

// Validated categorical slots (dataviz reference palette, light mode).
const SERIES = { neutraal: "#2a78d6", pessimistisch: "#eb6834", optimistisch: "#1baf7a" } as const;
const SINGLE = "#2a78d6";
const NEGATIVE = "#e34948";
const GRID = "#e9edf3";
const AXIS = "#7a89a1";

export function ResultsView({ result, insightsSlot }: { result: PlanResult; insightsSlot?: React.ReactNode }) {
  const w = result.wealth;
  const tiles = [
    { label: "Totaal vermogen", value: formatEuro(w.total, { whole: true }) },
    { label: "Vermogen privé", value: formatEuro(w.prive.total, { whole: true }) },
    { label: "Vermogen zakelijk", value: formatEuro(w.zakelijk.total, { whole: true }) },
    { label: "Netto inkomen per jaar", value: formatEuro(result.income.net, { whole: true }) },
    { label: "Jaarlijks saldo", value: formatEuro(result.income.balance, { whole: true }) },
    { label: "Belastingdruk", value: formatPercent(result.taxes.effectiveRate) },
  ];

  const wealthBars = [
    { name: "Eigen woning (netto)", value: w.prive.eigenWoningNet },
    { name: "Box 3 (netto)", value: w.prive.box3Net },
    { name: "Aandelen BV", value: w.zakelijk.shareValue },
  ];
  const incomeBars = [
    { name: "Netto inkomen", value: result.income.net },
    { name: "Uitgaven", value: result.income.expenses },
    { name: "Saldo", value: result.income.balance },
  ];
  const taxBars = result.taxes.lines.map((l) => ({ name: `Box ${l.box}`, value: l.tax, label: l.label }));

  return (
    <div className="space-y-5">
      {result.warnings.length > 0 ? (
        <div className="rounded-xl border border-warn-600/30 bg-warn-50 px-4 py-3 text-sm text-warn-600">
          {result.warnings.map((m) => (
            <p key={m} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}
            </p>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-ink-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs text-ink-500 sm:text-sm">{t.label}</div>
            <div className="mt-0.5 text-lg font-semibold text-ink-900 sm:text-2xl">{t.value}</div>
          </div>
        ))}
      </div>

      {insightsSlot}

      <ProjectionCard result={result} />

      <div className="grid gap-5 lg:grid-cols-2">
        <BarCard title="Vermogen privé vs. zakelijk" description="Netto waarden vandaag" data={wealthBars} />
        <BarCard title="Inkomsten vs. uitgaven" description="Per jaar, na belasting" data={incomeBars} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <BarCard
          title="Indicatie belastingdruk per box"
          description={`Totaal ${formatEuro(result.taxes.total, { whole: true })} · effectief ${formatPercent(result.taxes.effectiveRate)} van het bruto inkomen`}
          data={taxBars}
        />
        <Card>
          <CardHeader title="Box 3 toelichting" description="Forfaitair stelsel (indicatief)" />
          <dl className="divide-y divide-ink-100 text-sm">
            {[
              ["Rendementsgrondslag", result.taxes.box3.base],
              ["Forfaitair rendement", result.taxes.box3.deemedReturn],
              ["Heffingsvrij vermogen", result.taxes.box3.exemption],
              ["Grondslag sparen en beleggen", result.taxes.box3.taxableBase],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 px-4 py-2.5 sm:px-5">
                <dt className="text-ink-600">{k}</dt>
                <dd className="font-medium tabular">{formatEuro(v as number, { whole: true })}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <p className="text-xs text-ink-400">
        {result.engine.name} v{result.engine.version} · {result.engine.assumptionsLabel}. Niet geschikt als advies.
      </p>
    </div>
  );
}

function BarCard({ title, description, data }: { title: string; description: string; data: { name: string; value: number }[] }) {
  const height = 56 * data.length + 24;
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="px-2 py-3 sm:px-4">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 96, bottom: 4, left: 8 }} barCategoryGap={14}>
            <CartesianGrid horizontal={false} stroke={GRID} />
            <XAxis type="number" hide domain={[(min: number) => Math.min(0, min), "auto"]} />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#3f4d65", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "#f5f7fa" }}
              formatter={(v) => [formatEuro(Number(v), { whole: true }), "Bedrag"]}
              contentStyle={{ borderRadius: 8, borderColor: "#d3dae5", fontSize: 13 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.value < 0 ? NEGATIVE : SINGLE} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => formatEuroCompact(Number(v))}
                style={{ fill: "#2f3b50", fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function ProjectionCard({ result }: { result: PlanResult }) {
  const [showTable, setShowTable] = useState(false);
  const points = result.projection.points;
  const last = points[points.length - 1];
  const sc = result.projection.scenarios;
  const series = (["optimistisch", "neutraal", "pessimistisch"] as const).map((key) => ({
    key,
    label: `${sc[key].label} (${formatPercent(sc[key].returnRate)})`,
    color: SERIES[key],
  }));

  return (
    <Card>
      <CardHeader
        title="Verwachte vermogensontwikkeling"
        description={`Totaal netto vermogen, ${points[0]?.year}–${last?.year}, nominaal`}
        action={
          <button type="button" onClick={() => setShowTable((s) => !s)} className="text-sm font-medium text-brand-600 hover:underline">
            {showTable ? "Toon grafiek" : "Toon als tabel"}
          </button>
        }
      />
      {showTable ? (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm tabular">
            <thead className="sticky top-0 bg-ink-50 text-left text-xs text-ink-500">
              <tr>
                <th className="px-4 py-2 font-medium">Jaar</th>
                <th className="px-4 py-2 font-medium">Leeftijd</th>
                {series.map((s) => (
                  <th key={s.key} className="px-4 py-2 text-right font-medium">
                    {sc[s.key].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {points.map((p) => (
                <tr key={p.year}>
                  <td className="px-4 py-1.5">{p.year}</td>
                  <td className="px-4 py-1.5">{p.age ?? "—"}</td>
                  {series.map((s) => (
                    <td key={s.key} className="px-4 py-1.5 text-right">
                      {formatEuro(p[s.key], { whole: true })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-600">
            {series.map((s) => (
              <li key={s.key} className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: s.color }} />
                {s.label}
              </li>
            ))}
            {result.retirement.retirementYear ? (
              <li className="text-ink-500">Pensioen in {result.retirement.retirementYear}</li>
            ) : null}
          </ul>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={points} margin={{ top: 8, right: 72, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} minTickGap={24} />
              <YAxis
                tickFormatter={(v) => formatEuroCompact(Number(v))}
                tickLine={false}
                axisLine={false}
                tick={{ fill: AXIS, fontSize: 12 }}
                width={72}
              />
              <Tooltip
                formatter={(v, name) => [formatEuro(Number(v), { whole: true }), sc[name as keyof typeof sc]?.label ?? String(name)]}
                labelFormatter={(year) => {
                  const p = points.find((x) => x.year === year);
                  return p?.age ? `${year} · leeftijd ${p.age}` : String(year);
                }}
                contentStyle={{ borderRadius: 8, borderColor: "#d3dae5", fontSize: 13 }}
              />
              {series.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={s.key}
                    content={(props) => {
                      const { x, y, index } = props as { x: number; y: number; index: number };
                      if (index !== points.length - 1) return null;
                      return (
                        <text x={x + 6} y={y} dy={4} fontSize={11} fill="#2f3b50">
                          {formatEuroCompact(points[index][s.key])}
                        </text>
                      );
                    }}
                  />
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
