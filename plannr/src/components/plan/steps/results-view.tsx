"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { AlertTriangle } from "@/components/ui/icons";
import type { Insight, InsightTone } from "@/lib/insights";
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
  { key: "box3", label: "Sparen en beleggen (box 3)", color: "#C9871A" },
  { key: "bv", label: "BV (na box 2-belasting)", color: "#1D9B7C" },
  { key: "polissen", label: "Polissen en leningen", color: "#6250D6" },
  { key: "onderneming", label: "Eenmanszaak", color: "#E87BA4" },
] as const;

const TONE_DOT: Record<InsightTone, string> = { aandacht: "#9a5f08", kans: "#22704a", info: "#98938a" };

const CHART_EVENTS = new Set(["pensioen", "aow", "rentevast"]);

/** Quiet vertical markers for retirement, AOW and the end of fixed-rate periods; what they mean shows on hover. */
function eventMarkers(result: PlanResult) {
  return result.projection.events
    .filter((e) => CHART_EVENTS.has(e.kind))
    .map((e) => <ReferenceLine key={`${e.year}-${e.label}`} x={e.year} stroke="#C8C0B0" strokeDasharray="2 4" />);
}

/** Tooltip title: the year, the ages and what happens that year. */
function yearLabel(result: PlanResult, year: unknown) {
  const p = result.projection.points.find((x) => x.year === year);
  if (!p) return String(year);
  const ages = [p.age !== null ? `cliënt ${p.age}` : null, p.partnerAge !== null ? `partner ${p.partnerAge}` : null].filter(Boolean);
  const events = result.projection.events.filter((e) => e.year === year).map((e) => e.shortLabel);
  return [String(year), ages.join(", "), events.join(", ")].filter(Boolean).join(" · ");
}

export interface MissingLink {
  id: string;
  label: string;
  stepLabel: string;
  href: string;
}

type Tab = "overzicht" | "vermogen" | "kasstroom" | "belasting" | "gezin" | "keuzes";

export function ResultsView({
  result,
  insights = [],
  missing = [],
  choicesSlot,
}: {
  result: PlanResult;
  insights?: Insight[];
  /** Fields that are switched on but still empty, with a link to their step. */
  missing?: MissingLink[];
  choicesSlot?: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("overzicht");
  const [allInsights, setAllInsights] = useState(false);
  const w = result.wealth;
  const zakelijk = w.zakelijk.included;
  const family = result.household.persons.length > 1 || result.gifts !== null;
  const tiles = [
    { label: "Netto inkomen", value: formatEuro(result.income.net, { whole: true }), hint: "per jaar, na belasting" },
    { label: "Saldo", value: formatEuro(result.income.balance, { whole: true }), hint: "per jaar, na uitgaven" },
    { label: "Belastingdruk", value: formatPercent(result.taxes.effectiveRate), hint: "van het bruto inkomen" },
  ];
  const tabs: { key: Tab; label: string; hidden?: boolean }[] = [
    { key: "overzicht", label: "Overzicht" },
    { key: "vermogen", label: "Vermogen" },
    { key: "kasstroom", label: "Kasstroom" },
    { key: "belasting", label: "Belasting" },
    { key: "gezin", label: "Gezin", hidden: !family },
    { key: "keuzes", label: "Keuzes" },
  ];

  const wealthBars = [
    { name: "Eigen woning (netto)", value: w.prive.eigenWoningNet },
    { name: "Box 3 (netto)", value: w.prive.box3Net },
    ...(w.prive.otherAssetsTotal ? [{ name: "Polissen en leningen", value: w.prive.otherAssetsTotal }] : []),
    ...(zakelijk ? [{ name: "Aandelen BV", value: w.zakelijk.shareValue }] : []),
  ];
  const incomeBars = [
    { name: "Netto inkomen", value: result.income.net },
    { name: "Uitgaven", value: result.income.expenses },
    { name: "Saldo", value: result.income.balance },
  ];
  const taxBars = result.taxes.lines.filter((l) => zakelijk || l.box !== 2).map((l) => ({ name: `Box ${l.box}`, value: l.tax, label: l.label }));
  const shownInsights = allInsights ? insights : insights.slice(0, 3);

  return (
    <div className="space-y-8">
      <LifeSummary result={result} />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-ink-200 bg-ink-200 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
        <div className="col-span-2 bg-night px-5 py-5 text-ink-50 sm:px-6 sm:py-6 lg:col-span-1">
          <div className="eyebrow !text-gold-500">Totaal netto vermogen</div>
          <div className="mt-2 font-display text-[2.2rem] font-semibold leading-none tabular sm:text-[2.6rem]">{formatEuro(w.total, { whole: true })}</div>
          {zakelijk ? (
            <div className="mt-3 text-[13px] text-white/60">
              privé {formatEuro(w.prive.total, { whole: true })} · zakelijk {formatEuro(w.zakelijk.total, { whole: true })}
            </div>
          ) : null}
        </div>
        {tiles.map((t) => (
          <div key={t.label} className="bg-white px-4 py-4 last:col-span-2 sm:px-6 sm:py-6 lg:last:col-span-1">
            <div className="eyebrow">{t.label}</div>
            <div className="mt-2 font-display text-[1.6rem] font-semibold leading-none text-ink-900 tabular sm:text-[2rem]">{t.value}</div>
            <div className="mt-2 text-[12px] text-ink-500 sm:text-[13px]">{t.hint}</div>
          </div>
        ))}
      </div>

      <div role="tablist" aria-label="Onderdelen van de resultaten" className="-mx-1 flex gap-7 overflow-x-auto border-b border-ink-200 px-1">
        {tabs
          .filter((t) => !t.hidden)
          .map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px shrink-0 border-b-2 pb-3 text-sm transition-colors",
                tab === t.key ? "border-gold-500 font-semibold text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900",
              )}
            >
              {t.label}
            </button>
          ))}
      </div>

      <div role="tabpanel" key={tab} className="animate-[tab-in_200ms_ease-out]">
        {tab === "overzicht" ? (
          <div className="space-y-6">
            <WealthBar result={result} />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-6">
                {result.warnings.length > 0 ? (
                  <div className="space-y-1 border-l-2 border-warn-600 bg-warn-50 px-4 py-3 text-sm text-warn-600">
                    {result.warnings.map((m) => (
                      <p key={m} className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}
                      </p>
                    ))}
                  </div>
                ) : null}
                <YearFlowsCard result={result} />
              </div>
              <div className="space-y-6">
                {missing.length > 0 ? (
                  <div className="border border-warn-100 bg-warn-50 px-5 py-4">
                    <h3 className="text-sm font-semibold text-warn-600">Nog aan te vullen · {missing.length}</h3>
                    <p className="mt-1 text-xs text-ink-600">Aangezet, maar nog leeg. Lege velden tellen als € 0.</p>
                    <ul className="mt-3 divide-y divide-warn-100 text-[13px]">
                      {missing.slice(0, 8).map((m) => (
                        <li key={m.id}>
                          <Link href={m.href} className="flex items-baseline justify-between gap-3 py-2 text-ink-800 hover:text-ink-900">
                            <span className="min-w-0">{m.label}</span>
                            <span className="shrink-0 text-xs text-ink-500">{m.stepLabel} →</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {missing.length > 8 ? <p className="pt-2 text-xs text-ink-500">en {missing.length - 8} meer</p> : null}
                  </div>
                ) : null}
                <Card>
                  <CardHeader title="Aandachtspunten" />
                  {insights.length === 0 ? (
                    <p className="px-5 py-5 text-sm text-ink-500">Geen bijzondere aandachtspunten.</p>
                  ) : (
                    <ul className="divide-y divide-ink-100 px-5">
                      {shownInsights.map((i) => (
                        <li key={i.id} className="py-3">
                          <div className="flex items-baseline gap-3 text-[13.5px]">
                            <span className="h-[7px] w-[7px] shrink-0 -translate-y-px rounded-full" style={{ background: TONE_DOT[i.tone] }} aria-hidden="true" />
                            <span className="flex-1 font-medium text-ink-900">{i.title}</span>
                            {i.amount ? <span className="tabular text-ink-600">{formatEuro(i.amount.value, { whole: true })}</span> : null}
                          </div>
                          {allInsights ? <p className="mt-1 pl-5 text-[13px] text-ink-600">{i.body}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {insights.length > 3 || (insights.length > 0 && !allInsights) ? (
                    <button
                      type="button"
                      onClick={() => setAllInsights((x) => !x)}
                      className="w-full border-t border-ink-100 px-5 py-3 text-left text-[13px] font-medium text-ink-700 hover:text-ink-900"
                    >
                      {allInsights ? "Minder tonen" : insights.length > 3 ? `Alle ${insights.length} aandachtspunten met uitleg →` : "Uitleg tonen →"}
                    </button>
                  ) : null}
                </Card>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "vermogen" ? (
          <div className="space-y-6">
            <ProjectionCard result={result} />
            <BarCard title={zakelijk ? "Vermogen privé vs. zakelijk" : "Vermogen per onderdeel"} description="Netto waarden vandaag" data={wealthBars} />
          </div>
        ) : null}

        {tab === "kasstroom" ? (
          <div className="space-y-6">
            <CashFlowCard result={result} />
            <BarCard title="Inkomsten vs. uitgaven" description="Per jaar, na belasting" data={incomeBars} />
          </div>
        ) : null}

        {tab === "belasting" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <BarCard
              title="Indicatie belastingdruk per box"
              description={`Totaal ${formatEuro(result.taxes.total, { whole: true })} · effectief ${formatPercent(result.taxes.effectiveRate)} van het bruto inkomen`}
              data={taxBars}
            />
            <Card>
              <CardHeader title="Box 3" description="Forfaitair stelsel (indicatief)" />
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
        ) : null}

        {tab === "gezin" && family ? <HouseholdCard result={result} /> : null}

        {tab === "keuzes" ? choicesSlot : null}
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
                labelFormatter={(year) => yearLabel(result, year)}
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
                labelFormatter={(year) => yearLabel(result, year)}
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

const nlInt = new Intl.NumberFormat("nl-NL");
const years = (n: number) => `${nlInt.format(n)} jaar`;

/** "U bent nu 64 jaar, uw partner 61 jaar", with the years until stopping work and until AOW per person. */
function LifeSummary({ result }: { result: PlanResult }) {
  const ref = result.referenceYear;
  const persons = result.household.persons.filter((p) => p.birthYear);
  if (persons.length === 0) return null;
  const age = (p: (typeof persons)[number]) => ref - (p.birthYear ?? ref);
  const [client, partner] = persons;
  const until = (year: number | null, done: string, todo: (n: number) => string) => {
    if (year === null) return "—";
    const n = year - ref;
    return n <= 0 ? done : todo(n);
  };
  return (
    <div className="space-y-5">
      <p className="font-display text-[1.7rem] leading-snug text-ink-900 sm:text-[2rem]">
        {client.name} is nu {age(client)} jaar{partner ? `, ${partner.name} ${age(partner)} jaar` : ""}.
      </p>
      <div className={cn("grid gap-px overflow-hidden rounded-sm border border-ink-200 bg-ink-200", persons.length > 1 ? "sm:grid-cols-2" : "")}>
        {persons.map((p) => (
          <div key={p.role} className="grid grid-cols-2 gap-4 bg-white px-5 py-4">
            <div>
              <div className="eyebrow">Stoppen met werken · {p.name}</div>
              <div className="mt-1.5 font-display text-[1.5rem] font-semibold text-ink-900">
                {until(p.retirementYear, "Gestopt", (n) => `Nog ${years(n)}`)}
              </div>
              <div className="text-[13px] text-ink-500">
                {p.retirementYear ? `in ${p.retirementYear}, op ${p.retirementYear - (p.birthYear ?? 0)} jaar` : "stopleeftijd niet ingevuld"}
              </div>
            </div>
            <div>
              <div className="eyebrow">AOW · {p.name}</div>
              <div className="mt-1.5 font-display text-[1.5rem] font-semibold text-ink-900">{until(p.aowYear, "Ontvangt AOW", (n) => `Nog ${years(n)}`)}</div>
              <div className="text-[13px] text-ink-500">{p.aowYear ? `vanaf ${p.aowYear}, op ${p.aowAgeLabel}` : "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Today's net wealth as one horizontal bar, split by kind, with amounts and shares underneath. */
function WealthBar({ result }: { result: PlanResult }) {
  const c = result.projection.points[0]?.components;
  if (!c) return null;
  const parts = PARTS.map((p) => ({ ...p, value: c[p.key] }));
  const positive = parts.filter((p) => p.value > 0.5);
  const negative = parts.filter((p) => p.value < -0.5);
  const total = positive.reduce((x, p) => x + p.value, 0);
  if (total <= 0) return null;
  return (
    <Card>
      <CardHeader title="Uw vermogen nu" description={`Netto, na schulden${result.wealth.zakelijk.included ? " en na de box 2-belasting die bij uitkeren uit de BV nog betaald moet worden" : ""}.`} />
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-[2rem] font-semibold text-ink-900 tabular">{formatEuro(result.wealth.total, { whole: true })}</span>
        </div>
        <div className="flex h-10 w-full overflow-hidden rounded-sm" role="img" aria-label="Verdeling van het vermogen">
          {positive.map((p, i) => (
            <div
              key={p.key}
              title={`${p.label}: ${formatEuro(p.value, { whole: true })}`}
              style={{ width: `${(p.value / total) * 100}%`, background: p.color, marginLeft: i === 0 ? 0 : 2 }}
            />
          ))}
        </div>
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-5">
          {positive.map((p) => (
            <li key={p.key} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink-600">{p.label}</span>
                <span className="block whitespace-nowrap font-semibold text-ink-900 tabular">{formatEuro(p.value, { whole: true })}</span>
                <span className="block text-[13px] text-ink-500 tabular">{formatPercent(p.value / total)}</span>
              </span>
            </li>
          ))}
          {negative.map((p) => (
            <li key={p.key} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm border border-danger-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-[13px] text-ink-600">{p.label}</span>
                <span className="block font-semibold text-danger-600 tabular">{formatEuro(p.value, { whole: true })}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

const FLOW_IN = [
  { key: "work", label: "Werk en onderneming", color: "#2B5FA3" },
  { key: "dividend", label: "Dividend", color: "#1D9B7C" },
  { key: "pension", label: "Pensioen", color: "#C9871A" },
  { key: "aow", label: "AOW", color: "#6250D6" },
  { key: "other", label: "Lijfrente en overig", color: "#E87BA4" },
] as const;
const FLOW_OUT = [
  { key: "tax", label: "Belasting", color: "#98938A" },
  { key: "spending", label: "Uitgaven", color: "#C8C0B0" },
] as const;

/** Per year: income stacked above zero, tax and spending below, and the balance as a line (today's money). */
function YearFlowsCard({ result }: { result: PlanResult }) {
  const points = result.projection.points;
  const inKeys = FLOW_IN.filter((k) => points.some((p) => Math.abs(p.flows[k.key]) > 0.5));
  const data = points.map((p) => ({
    year: p.year,
    ...Object.fromEntries(inKeys.map((k) => [k.key, p.flows[k.key]])),
    tax: -p.flows.tax,
    spending: -p.flows.spending,
    balance: p.flows.balance,
  }));
  const label = (key: string) =>
    key === "balance" ? "Over / tekort" : ([...FLOW_IN, ...FLOW_OUT].find((k) => k.key === key)?.label ?? key);
  return (
    <Card>
      <CardHeader
        title="Inkomsten en uitgaven per jaar"
        description="In geld van nu. Boven de nul wat binnenkomt, onder de nul belasting en uitgaven; de lijn is wat er overblijft of tekortkomt."
      />
      <div className="px-2 pb-3 pt-4 sm:px-4">
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-ink-600">
          {[...inKeys, ...FLOW_OUT].map((k) => (
            <li key={k.key} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} />
              {k.label}
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-ink-900" />
            Over / tekort
          </li>
        </ul>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }} stackOffset="sign" barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: GRID }} tick={{ fill: AXIS, fontSize: 12 }} minTickGap={24} />
            <YAxis tickFormatter={(v) => formatEuroCompact(Number(v))} tickLine={false} axisLine={false} tick={{ fill: AXIS, fontSize: 12 }} width={72} />
            <ReferenceLine y={0} stroke="#33363c" />
            {eventMarkers(result)}
            <Tooltip
              formatter={(v, name) => [formatEuro(Math.abs(Number(v)), { whole: true }), label(String(name))]}
              labelFormatter={(year) => yearLabel(result, year)}
              contentStyle={{ borderRadius: 2, borderColor: "#e2dbcc", fontSize: 13 }}
            />
            {[...inKeys, ...FLOW_OUT].map((k) => (
              <Bar key={k.key} dataKey={k.key} stackId="flows" fill={k.color} isAnimationActive={false} />
            ))}
            <Line type="monotone" dataKey="balance" stroke="#14171c" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
