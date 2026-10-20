"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
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
// Five categorical slots for the wealth composition (validated with the dataviz palette checker;
// orange and magenta are below 3:1 on white, so the card also offers a table view).
const PARTS = [
  { key: "woning", label: "Eigen woning (netto)", color: "#2B5FA3" },
  { key: "box3", label: "Box 3", color: "#C9871A" },
  { key: "bv", label: "BV", color: "#1D9B7C" },
  { key: "polissen", label: "Polissen en leningen", color: "#6250D6" },
  { key: "onderneming", label: "Eenmanszaak", color: "#E87BA4" },
] as const;

/** Vertical markers for retirement and AOW, labelled at the top. */
function eventMarkers(result: PlanResult) {
  return result.projection.events.map((e, i) => (
    <ReferenceLine
      key={`${e.year}-${e.label}`}
      x={e.year}
      stroke="#98938A"
      strokeDasharray="3 3"
      label={{ value: e.shortLabel, position: "insideTopLeft", fill: "#4a4e55", fontSize: 10, dy: (i % 3) * 12 }}
    />
  ));
}

function yearLabel(points: PlanResult["projection"]["points"], year: unknown) {
  const p = points.find((x) => x.year === year);
  if (!p) return String(year);
  const ages = [p.age !== null ? `cliënt ${p.age}` : null, p.partnerAge !== null ? `partner ${p.partnerAge}` : null].filter(Boolean);
  return ages.length ? `${year} · ${ages.join(", ")}` : String(year);
}

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
    ...(w.prive.otherAssetsTotal ? [{ name: "Polissen en leningen", value: w.prive.otherAssetsTotal }] : []),
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

      <CompositionCard result={result} />

      <CashFlowCard result={result} />

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
                {points.some((p) => p.partnerAge !== null) ? <th className="px-4 py-2 font-medium">Partner</th> : null}
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
                  {points.some((x) => x.partnerAge !== null) ? <td className="px-4 py-1.5">{p.partnerAge ?? "—"}</td> : null}
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
            {result.projection.events.length > 0 ? (
              <li className="w-full text-ink-500">
                Stippellijnen: {result.projection.events.map((e) => `${e.label} in ${e.year}`).join(" · ")}
              </li>
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
                labelFormatter={(year) => yearLabel(points, year)}
                contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
              />
              {eventMarkers(result)}
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
                  <td className="px-3 py-2.5 text-right">{formatEuro(p.grossEmployment + p.dgaSalary + p.businessProfit + p.dividendReceived + p.otherIncome + p.taxFreeIncome, { whole: true })}</td>
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

/** Household net income vs. spending per year (neutral scenario, nominal). */
function CashFlowCard({ result }: { result: PlanResult }) {
  const [showTable, setShowTable] = useState(false);
  const points = result.projection.points;
  const series = [
    { key: "netIncome" as const, label: "Netto inkomen", color: SERIES.neutraal },
    { key: "spending" as const, label: "Uitgaven", color: SERIES.optimistisch },
  ];
  return (
    <Card>
      <CardHeader
        title="Inkomsten en uitgaven per jaar"
        description="Netto inkomen na belasting en alle uitgaven (incl. posten met een periode en schenkingen), nominaal"
        action={
          <button type="button" onClick={() => setShowTable((x) => !x)} className="text-sm font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2">
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
                <th className="px-4 py-2 text-right font-medium">Netto inkomen</th>
                <th className="px-4 py-2 text-right font-medium">Uitgaven</th>
                <th className="px-4 py-2 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {points.map((p) => (
                <tr key={p.year}>
                  <td className="px-4 py-1.5">{p.year}</td>
                  <td className="px-4 py-1.5">{p.age ?? "—"}</td>
                  <td className="px-4 py-1.5 text-right">{formatEuro(p.netIncome, { whole: true })}</td>
                  <td className="px-4 py-1.5 text-right">{formatEuro(p.spending, { whole: true })}</td>
                  <td className={`px-4 py-1.5 text-right ${p.netIncome - p.spending < 0 ? "text-danger-600" : ""}`}>
                    {formatEuro(p.netIncome - p.spending, { whole: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-600">
            {series.map((x) => (
              <li key={x.key} className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded" style={{ background: x.color }} />
                {x.label}
              </li>
            ))}
            <li className="text-ink-500">Een tekort wordt aangevuld uit vermogen</li>
          </ul>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={(v) => formatEuroCompact(Number(v))} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={72} />
              <Tooltip
                formatter={(v, name) => [formatEuro(Number(v), { whole: true }), series.find((x) => x.key === name)?.label ?? String(name)]}
                labelFormatter={(year) => yearLabel(points, year)}
                contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
              />
              {eventMarkers(result)}
              {series.map((x) => (
                <Line key={x.key} type="stepAfter" dataKey={x.key} stroke={x.color} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/** What the total is made of over time (neutral scenario), with how much each part grows. */
function CompositionCard({ result }: { result: PlanResult }) {
  const [showTable, setShowTable] = useState(false);
  const points = result.projection.points;
  const parts = PARTS.filter((part) => points.some((p) => Math.abs(p.components[part.key]) > 0.5));
  const data = points.map((p) => ({ year: p.year, totaal: p.neutraal, ...p.components }));
  const first = points[0];
  const last = points[points.length - 1];
  const retYear = result.retirement.retirementYear;
  const atRet = retYear !== null ? points.find((p) => p.year === retYear) : undefined;
  if (!first || !last || parts.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Samenstelling van het vermogen"
        description={`Neutraal scenario, nominaal, ${first.year}–${last.year}. De lijn is het totaal.`}
        action={
          <button type="button" onClick={() => setShowTable((x) => !x)} className="text-sm font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2">
            {showTable ? "Toon grafiek" : "Toon als tabel"}
          </button>
        }
      />
      {showTable ? null : (
        <div className="px-2 pb-1 pt-4 sm:px-4">
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-600">
            {parts.map((part) => (
              <li key={part.key} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: part.color }} />
                {part.label}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded bg-ink-900" />
              Totaal
            </li>
          </ul>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 8, right: 24, bottom: 0, left: 0 }} stackOffset="sign">
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} minTickGap={24} />
              <YAxis tickFormatter={(v) => formatEuroCompact(Number(v))} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={72} />
              <Tooltip
                formatter={(v, name) => [
                  formatEuro(Number(v), { whole: true }),
                  name === "totaal" ? "Totaal" : (PARTS.find((x) => x.key === name)?.label ?? String(name)),
                ]}
                labelFormatter={(year) => yearLabel(points, year)}
                contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
              />
              {eventMarkers(result)}
              {parts.map((part) => (
                <Area
                  key={part.key}
                  type="monotone"
                  dataKey={part.key}
                  stackId="v"
                  stroke="#ffffff"
                  strokeWidth={2}
                  fill={part.color}
                  fillOpacity={0.9}
                  isAnimationActive={false}
                />
              ))}
              <Area type="monotone" dataKey="totaal" stroke="#1f2328" strokeWidth={2} fill="none" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular">
          <thead>
            <tr className="border-y border-ink-100 bg-ink-50 text-left text-xs text-ink-500">
              <th className="px-4 py-2 font-medium sm:px-5">Onderdeel</th>
              <th className="px-4 py-2 text-right font-medium">{first.year}</th>
              {atRet ? <th className="px-4 py-2 text-right font-medium">Bij pensioen ({atRet.year})</th> : null}
              <th className="px-4 py-2 text-right font-medium">{last.year}</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">Verandering</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {parts.map((part) => {
              const change = last.components[part.key] - first.components[part.key];
              return (
                <tr key={part.key}>
                  <td className="px-4 py-2 sm:px-5">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: part.color }} />
                    {part.label}
                  </td>
                  <td className="px-4 py-2 text-right">{formatEuro(first.components[part.key], { whole: true })}</td>
                  {atRet ? <td className="px-4 py-2 text-right">{formatEuro(atRet.components[part.key], { whole: true })}</td> : null}
                  <td className="px-4 py-2 text-right">{formatEuro(last.components[part.key], { whole: true })}</td>
                  <td className={`px-4 py-2 text-right sm:px-5 ${change < 0 ? "text-danger-600" : ""}`}>
                    {change >= 0 ? "+" : ""}
                    {formatEuro(change, { whole: true })}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-ink-900 font-semibold">
              <td className="px-4 py-2 sm:px-5">Totaal</td>
              <td className="px-4 py-2 text-right">{formatEuro(first.neutraal, { whole: true })}</td>
              {atRet ? <td className="px-4 py-2 text-right">{formatEuro(atRet.neutraal, { whole: true })}</td> : null}
              <td className="px-4 py-2 text-right">{formatEuro(last.neutraal, { whole: true })}</td>
              <td className="px-4 py-2 text-right sm:px-5">
                {last.neutraal - first.neutraal >= 0 ? "+" : ""}
                {formatEuro(last.neutraal - first.neutraal, { whole: true })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
