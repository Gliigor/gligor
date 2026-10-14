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
// Validated with the dataviz palette checker (colour-blind safe, ≥ 3:1 on white).
const SERIES = { neutraal: "#2B5FA3", optimistisch: "#C9871A", pessimistisch: "#1D9B7C" } as const;
const SINGLE = "#2B5FA3";
const NEGATIVE = "#A8261D";
const GRID = "#ECE7DC";
const AXIS = "#98938A";

export function ResultsView({
  result,
  insightsSlot,
  choicesSlot,
}: {
  result: PlanResult;
  insightsSlot?: React.ReactNode;
  choicesSlot?: React.ReactNode;
}) {
  const w = result.wealth;
  const tiles = [
    { label: "Totaal vermogen", value: formatEuro(w.total, { whole: true }), hint: "" },
    { label: "Vermogen privé", value: formatEuro(w.prive.total, { whole: true }), hint: "" },
    { label: "Vermogen zakelijk", value: formatEuro(w.zakelijk.total, { whole: true }), hint: "" },
    { label: "Netto inkomen", value: formatEuro(result.income.net, { whole: true }), hint: "per jaar, na belasting" },
    { label: "Saldo", value: formatEuro(result.income.balance, { whole: true }), hint: "per jaar, na uitgaven" },
    { label: "Belastingdruk", value: formatPercent(result.taxes.effectiveRate), hint: "van het bruto inkomen" },
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

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-ink-200 bg-ink-200 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <div className="col-span-2 bg-night px-5 py-5 text-ink-50 sm:px-6 sm:py-6 lg:col-span-1">
          <div className="eyebrow !text-gold-500">Totaal netto vermogen</div>
          <div className="mt-2 font-display text-[2.2rem] font-semibold leading-none tabular sm:text-[2.6rem]">{formatEuro(w.total, { whole: true })}</div>
          <div className="mt-3 text-[13px] text-white/60">
            privé {formatEuro(w.prive.total, { whole: true })} · zakelijk {formatEuro(w.zakelijk.total, { whole: true })}
          </div>
        </div>
        {tiles.slice(3).map((t) => (
          <div key={t.label} className="bg-white px-4 py-4 last:col-span-2 sm:px-6 sm:py-6 lg:last:col-span-1">
            <div className="eyebrow">{t.label}</div>
            <div className="mt-2 font-display text-[1.6rem] font-semibold leading-none text-ink-900 tabular sm:text-[2rem]">{t.value}</div>
            <div className="mt-2 text-[12px] text-ink-500 sm:text-[13px]">{t.hint}</div>
          </div>
        ))}
      </div>

      {insightsSlot}

      <ProjectionCard result={result} />

      {choicesSlot}

      {result.household.persons.length > 1 || result.gifts ? <HouseholdCard result={result} /> : null}

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
              tick={{ fill: "#4a4e55", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "#f5f2eb" }}
              formatter={(v) => [formatEuro(Number(v), { whole: true }), "Bedrag"]}
              contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.value < 0 ? NEGATIVE : SINGLE} />
              ))}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => formatEuroCompact(Number(v))}
                style={{ fill: "#33363c", fontSize: 12 }}
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
          <button type="button" onClick={() => setShowTable((s) => !s)} className="text-sm font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2">
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
                contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
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
                        <text x={x + 6} y={y} dy={4} fontSize={11} fill="#33363c">
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

function HouseholdCard({ result }: { result: PlanResult }) {
  const persons = result.household.persons;
  const gifts = result.gifts;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Per persoon"
          description={
            persons.length > 1
              ? result.household.fiscalPartners
                ? "Fiscaal partners: box 2 en box 3 zijn zo gunstig mogelijk verdeeld."
                : "Geen fiscaal partners: verdeling volgens eigendom."
              : "Eén persoon"
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular">
            <thead className="text-left text-xs text-ink-500">
              <tr className="border-b border-ink-100">
                <th className="px-5 py-2 font-medium">Naam</th>
                <th className="px-3 py-2 text-right font-medium">Bruto</th>
                <th className="px-3 py-2 text-right font-medium">Belasting</th>
                <th className="px-5 py-2 text-right font-medium">Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {persons.map((p) => (
                <tr key={p.role}>
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-ink-500">
                      {p.retirementYear ? `stopt ${p.retirementYear}` : "stopmoment onbekend"} · AOW {p.aowYear ?? "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">{formatEuro(p.grossEmployment + p.dgaSalary + p.dividendReceived, { whole: true })}</td>
                  <td className="px-3 py-2.5 text-right">{formatEuro(p.box1Tax + p.box2Tax + p.box3Tax, { whole: true })}</td>
                  <td className="px-5 py-2.5 text-right font-semibold">{formatEuro(p.net, { whole: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {gifts ? (
        <Card>
          <CardHeader title={`Schenkingen in ${gifts.year}`} description={`Totaal gepland: ${formatEuro(gifts.totalPlanned, { whole: true })}`} />
          {gifts.perChild.length === 0 ? (
            <p className="px-5 py-5 text-sm text-ink-500">Dit jaar geen schenkingen gepland.</p>
          ) : (
            <table className="w-full text-sm tabular">
              <thead className="text-left text-xs text-ink-500">
                <tr className="border-b border-ink-100">
                  <th className="px-5 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 text-right font-medium">Schenking</th>
                  <th className="px-3 py-2 text-right font-medium">Vrijgesteld</th>
                  <th className="px-5 py-2 text-right font-medium">Schenkbelasting</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {gifts.perChild.map((c) => (
                  <tr key={c.name}>
                    <td className="px-5 py-2.5">
                      {c.name}
                      {c.age !== null ? <span className="text-ink-500"> · {c.age} jaar</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right">{formatEuro(c.amount, { whole: true })}</td>
                    <td className="px-3 py-2.5 text-right">{formatEuro(Math.min(c.amount, c.exemption), { whole: true })}</td>
                    <td className={`px-5 py-2.5 text-right ${c.giftTax > 0 ? "font-semibold text-warn-600" : ""}`}>
                      {formatEuro(c.giftTax, { whole: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}
    </div>
  );
}
