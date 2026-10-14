// Client-facing PDF report, rendered server-side with React-PDF in the firm's
// house style. All numbers come from a PlanResult (i.e. from calculatePlan());
// the "Aandachtspunten" come from the deterministic rules in src/lib/insights.
//
// Structure: colour cover → contents → one section per page group, each with a
// numbered opener. Page numbers in the contents are filled in by a two-pass
// render (see renderReportPdf in ./render.tsx).

import { Circle, Document, Image, Page, Polyline, StyleSheet, Svg, Line as SvgLine, Text, View } from "@react-pdf/renderer";
import type { PlanResult } from "@/lib/engine/types";
import type { HouseStyle } from "@/lib/house-style/types";
import { INSIGHT_TONE_LABELS, type Insight, type InsightTone } from "@/lib/insights";
import { REPORT_SECTIONS, type ReportSectionKey } from "@/lib/plan/definitions";
import { formatDate, formatEuro, formatEuroCompact, formatPercent } from "@/lib/format";

export interface ReportData {
  firmName: string;
  clientName: string;
  companyName: string | null;
  planTitle: string;
  plannerName: string | null;
  generatedAt: Date;
  result: PlanResult;
  sections: ReportSectionKey[];
  /** Aandachtspunten shown in the report (already filtered by the planner). */
  insights: Insight[];
}

export interface ReportLogo {
  data: Buffer;
  format: "png" | "jpg";
}

/** Page on which each section starts; filled by the first render pass. */
export type SectionPages = Partial<Record<ReportSectionKey, number>>;

const TEXT = "#1d2129";
const MUTED = "#5d6573";
const SUBTLE = "#8a93a3";
const RULE = "#e2e5ea";
const PAPER = "#f6f5f2";
const NEGATIVE = "#b42323";
const TONE_COLORS: Record<InsightTone, string> = { aandacht: "#b7791f", kans: "#2f7d55", info: "#5d6573" };

// --- colour helpers -----------------------------------------------------------

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Mixes a hex colour with white. amount 0 = colour, 1 = white. */
export function tint(hex: string, amount: number): string {
  const { r, g, b } = rgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${((1 << 24) | (mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).slice(1)}`;
}

/** Mixes a hex colour with black. */
function shade(hex: string, amount: number): string {
  const { r, g, b } = rgb(hex);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return `#${((1 << 24) | (mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).slice(1)}`;
}

function luminance(hex: string): number {
  const { r, g, b } = rgb(hex);
  const ch = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Readable text colours on a given background. */
function onColor(bg: string) {
  const dark = luminance(bg) > 0.45;
  return dark ? { text: "#14171c", soft: "#3a404b" } : { text: "#ffffff", soft: tint(bg, 0.72) };
}

/** A dark, legible version of the brand colour for headings on white. */
function inkOf(hex: string): string {
  return luminance(hex) > 0.3 ? shade(hex, 0.45) : hex;
}

/** Ends a sentence without doubling the full stop of names like "B.V.". */
function withFullStop(text: string): string {
  return text.endsWith(".") ? text : `${text}.`;
}

// --- styles -------------------------------------------------------------------

function makeStyles(hs: HouseStyle) {
  const ink = inkOf(hs.primaryColor);
  return StyleSheet.create({
    page: {
      fontFamily: hs.fontBody,
      fontSize: 9.5,
      color: TEXT,
      paddingTop: 78,
      paddingBottom: 64,
      paddingHorizontal: 56,
      lineHeight: 1.5,
    },
    lead: { color: MUTED, marginBottom: 12, fontSize: 10, lineHeight: 1.55 },
    h3: { fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 11.5, color: ink, marginBottom: 6, marginTop: 4 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: RULE },
    rowTotal: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 6,
      marginTop: 2,
      borderTopWidth: 1,
      borderTopColor: TEXT,
    },
    cellLabel: { flex: 1, paddingRight: 8 },
    cellValue: { width: 96, textAlign: "right" },
    bold: { fontWeight: 700 },
    section: { marginBottom: 20 },
    ink: { color: ink },
  });
}

type Styles = ReturnType<typeof makeStyles>;

// --- building blocks -----------------------------------------------------------

function LogoPlate({ logo, firmName, hs, size = "lg" }: { logo?: ReportLogo | null; firmName: string; hs: HouseStyle; size?: "lg" | "sm" }) {
  if (!logo) {
    return (
      <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: size === "lg" ? 15 : 9 }}>{firmName}</Text>
    );
  }
  return (
    <View
      style={{
        backgroundColor: "#ffffff",
        paddingVertical: size === "lg" ? 14 : 0,
        paddingHorizontal: size === "lg" ? 18 : 0,
        borderRadius: 3,
        alignSelf: "flex-start",
      }}
    >
      {/* React-PDF's Image has no alt attribute (PDF images are not HTML). */}
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={logo} style={{ maxWidth: size === "lg" ? 180 : 90, maxHeight: size === "lg" ? 60 : 22, objectFit: "contain" }} />
    </View>
  );
}

function Table({ rows, s, total }: { rows: [string, number][]; s: Styles; total?: [string, number] }) {
  return (
    <View>
      {rows.map(([label, value]) => (
        <View key={label} style={s.row} wrap={false}>
          <Text style={s.cellLabel}>{label}</Text>
          <Text style={[s.cellValue, value < 0 ? { color: NEGATIVE } : {}]}>{formatEuro(value, { whole: true })}</Text>
        </View>
      ))}
      {total ? (
        <View style={s.rowTotal} wrap={false}>
          <Text style={[s.cellLabel, s.bold]}>{total[0]}</Text>
          <Text style={[s.cellValue, s.bold]}>{formatEuro(total[1], { whole: true })}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Bars({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <View style={{ marginTop: 12 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 7 }} wrap={false}>
          <Text style={{ width: 118, fontSize: 8.5, color: MUTED }}>{d.label}</Text>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: `${Math.max(1, (Math.abs(d.value) / max) * 100)}%`,
                maxWidth: "80%",
                height: 11,
                backgroundColor: d.value < 0 ? NEGATIVE : color,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
              }}
            />
            <Text style={{ fontSize: 8.5, marginLeft: 6 }}>{formatEuroCompact(d.value)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Tiles({ items, hs }: { items: { label: string; value: string }[]; hs: HouseStyle }) {
  const v = hs.layoutVariant;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
      {items.map((t) => (
        <View key={t.label} style={{ width: "33.33%", padding: 4 }} wrap={false}>
          <View
            style={{
              paddingVertical: 10,
              paddingHorizontal: 11,
              backgroundColor: v === "minimalistisch" ? "#ffffff" : v === "modern" ? tint(hs.primaryColor, 0.92) : PAPER,
              borderLeftWidth: v === "klassiek" ? 2 : 0,
              borderLeftColor: hs.accentColor,
              borderWidth: v === "minimalistisch" ? 0.5 : 0,
              borderColor: RULE,
              borderRadius: v === "modern" ? 4 : 0,
            }}
          >
            <Text style={{ fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 }}>{t.label}</Text>
            <Text style={{ fontFamily: hs.fontHeading, fontSize: 14, fontWeight: 700, color: inkOf(hs.primaryColor), marginTop: 3 }}>
              {t.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ProjectionChart({ result, hs }: { result: PlanResult; hs: HouseStyle }) {
  const W = 483;
  const H = 200;
  const padL = 56;
  const padR = 62;
  const padT = 8;
  const padB = 20;
  const pts = result.projection.points;
  const keys = ["optimistisch", "neutraal", "pessimistisch"] as const;
  const colors = { optimistisch: hs.accentColor, neutraal: inkOf(hs.primaryColor), pessimistisch: hs.secondaryColor };
  const values = pts.flatMap((p) => keys.map((k) => p[k]));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const x = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const sc = result.projection.scenarios;
  const retireIndex = result.retirement.retirementYear ? pts.findIndex((p) => p.year === result.retirement.retirementYear) : -1;

  return (
    <View wrap={false}>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {keys.map((k) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
            <View style={{ width: 12, height: 2, backgroundColor: colors[k], marginRight: 4 }} />
            <Text style={{ fontSize: 7.5, color: MUTED }}>
              {sc[k].label} ({formatPercent(sc[k].returnRate)})
            </Text>
          </View>
        ))}
      </View>
      <Svg width={W} height={H}>
        {ticks.map((t) => (
          <SvgLine key={t} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth={0.5} />
        ))}
        {retireIndex > 0 ? (
          <SvgLine x1={x(retireIndex)} x2={x(retireIndex)} y1={padT} y2={H - padB} stroke={SUBTLE} strokeWidth={0.5} strokeDasharray="2 2" />
        ) : null}
        {retireIndex > 0 ? (
          <Text x={x(retireIndex) + 3} y={padT + 8} style={{ fontSize: 6.5, fill: SUBTLE }}>
            pensioen
          </Text>
        ) : null}
        {ticks.map((t) => (
          <Text key={`l${t}`} x={padL - 6} y={y(t) + 3} style={{ fontSize: 7, fill: MUTED }} textAnchor="end">
            {formatEuroCompact(t)}
          </Text>
        ))}
        {pts
          .filter((_, i) => i % 5 === 0)
          .map((p) => {
            const i = pts.indexOf(p);
            return (
              <Text key={p.year} x={x(i)} y={H - 6} style={{ fontSize: 7, fill: MUTED }} textAnchor="middle">
                {String(p.year)}
              </Text>
            );
          })}
        {keys.map((k) => (
          <Polyline
            key={k}
            points={pts.map((p, i) => `${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ")}
            stroke={colors[k]}
            strokeWidth={k === "neutraal" ? 2 : 1.4}
            fill="none"
          />
        ))}
        {keys.map((k) => (
          <Text key={`e${k}`} x={x(pts.length - 1) + 4} y={y(pts[pts.length - 1][k]) + 3} style={{ fontSize: 7, fill: TEXT }}>
            {formatEuroCompact(pts[pts.length - 1][k])}
          </Text>
        ))}
      </Svg>
    </View>
  );
}

function InsightCard({ insight, hs }: { insight: Insight; hs: HouseStyle }) {
  const color = TONE_COLORS[insight.tone];
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        marginBottom: 9,
        borderLeftWidth: 2.5,
        borderLeftColor: color,
        backgroundColor: hs.layoutVariant === "minimalistisch" ? "#ffffff" : PAPER,
        borderWidth: hs.layoutVariant === "minimalistisch" ? 0.5 : 0,
        borderColor: RULE,
        paddingVertical: 9,
        paddingHorizontal: 11,
      }}
    >
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={{ fontSize: 7, color, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
          {INSIGHT_TONE_LABELS[insight.tone]}
        </Text>
        <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 11, marginTop: 2, marginBottom: 3 }}>{insight.title}</Text>
        <Text style={{ color: MUTED, fontSize: 9 }}>{insight.body}</Text>
      </View>
      {insight.amount ? (
        <View style={{ width: 110, alignItems: "flex-end", justifyContent: "center" }}>
          <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 13, color: TEXT }}>
            {formatEuro(insight.amount.value, { whole: true })}
          </Text>
          <Text style={{ fontSize: 7, color: MUTED, textAlign: "right", marginTop: 2 }}>{insight.amount.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

// --- section openers --------------------------------------------------------------

function SectionOpener({
  number,
  title,
  intro,
  hs,
}: {
  number: number;
  title: string;
  intro?: string;
  hs: HouseStyle;
}) {
  const v = hs.layoutVariant;
  const nr = String(number).padStart(2, "0");
  const ink = inkOf(hs.primaryColor);

  if (v === "modern") {
    return (
      <View style={{ marginBottom: 18 }} wrap={false} minPresenceAhead={160}>
        <View style={{ backgroundColor: hs.primaryColor, paddingVertical: 16, paddingHorizontal: 18, borderRadius: 4, flexDirection: "row", alignItems: "flex-end" }}>
          <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 30, color: hs.accentColor, marginRight: 14, lineHeight: 1 }}>{nr}</Text>
          <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 20, color: onColor(hs.primaryColor).text, lineHeight: 1.15 }}>{title}</Text>
        </View>
        {intro ? <Text style={{ color: MUTED, fontSize: 10, marginTop: 10, lineHeight: 1.55 }}>{intro}</Text> : null}
      </View>
    );
  }
  if (v === "minimalistisch") {
    return (
      <View style={{ marginBottom: 18 }} wrap={false} minPresenceAhead={160}>
        <Text style={{ fontSize: 7.5, color: SUBTLE, letterSpacing: 2, textTransform: "uppercase" }}>Hoofdstuk {nr}</Text>
        <Text style={{ fontFamily: hs.fontHeading, fontSize: 24, color: TEXT, marginTop: 4, lineHeight: 1.15 }}>{title}</Text>
        <View style={{ width: 28, height: 1.5, backgroundColor: hs.primaryColor, marginTop: 10, marginBottom: intro ? 10 : 0 }} />
        {intro ? <Text style={{ color: MUTED, fontSize: 10, lineHeight: 1.55 }}>{intro}</Text> : null}
      </View>
    );
  }
  // klassiek
  return (
    <View style={{ marginBottom: 18 }} wrap={false} minPresenceAhead={160}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: ink, paddingBottom: 7 }}>
        <Text style={{ fontFamily: hs.fontHeading, fontSize: 11, color: hs.accentColor, marginRight: 10, letterSpacing: 1, paddingBottom: 3 }}>{nr}</Text>
        <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 21, color: ink, lineHeight: 1.15 }}>{title}</Text>
      </View>
      {intro ? <Text style={{ color: MUTED, fontSize: 10, marginTop: 10, lineHeight: 1.55 }}>{intro}</Text> : null}
    </View>
  );
}

// --- section bodies -----------------------------------------------------------------

function summaryText(r: PlanResult): string {
  const parts = [
    `Uw totale netto vermogen bedraagt ${formatEuro(r.wealth.total, { whole: true })}, waarvan ${formatEuro(r.wealth.prive.total, { whole: true })} privé en ${formatEuro(r.wealth.zakelijk.total, { whole: true })} zakelijk.`,
  ];
  if (r.income.expenses > 0) {
    parts.push(
      r.income.balance >= 0
        ? `Na belastingen en uitgaven houdt u jaarlijks ongeveer ${formatEuro(r.income.balance, { whole: true })} over.`
        : `Uw jaarlijkse uitgaven zijn ongeveer ${formatEuro(-r.income.balance, { whole: true })} hoger dan uw netto inkomen.`,
    );
  }
  const last = r.projection.points[r.projection.points.length - 1];
  if (last) {
    parts.push(
      `In het neutrale scenario groeit het vermogen naar circa ${formatEuro(last.neutraal, { whole: true })} in ${last.year}; dat is ${formatEuro(last.neutraalReeel, { whole: true })} in de koopkracht van vandaag.`,
    );
  }
  return parts.join(" ");
}

const BOX_EXPLANATION: Record<1 | 2 | 3, { what: string; how: string }> = {
  1: {
    what: "Inkomen uit werk en woning: salaris (ook het salaris uit uw eigen BV), pensioen en het eigenwoningforfait, verminderd met de betaalde hypotheekrente.",
    how: "Progressief tarief: hoe hoger het inkomen, hoe hoger het tarief op elke extra euro. Hypotheekrente is aftrekbaar tegen maximaal het tarief van de middelste schijf.",
  },
  2: {
    what: "Inkomen uit aanmerkelijk belang (5% of meer van de aandelen in een BV): vooral dividend en de winst bij verkoop van aandelen.",
    how: "Twee tarieven: een laag tarief tot een vaste grens per persoon en een hoger tarief daarboven. De BV heeft over dezelfde winst al vennootschapsbelasting betaald.",
  },
  3: {
    what: "Vermogen in sparen en beleggen: spaargeld, beleggingen en overig vastgoed, verminderd met schulden. Uw eigen woning en uw BV-aandelen vallen hier niet onder.",
    how: "Niet het werkelijke rendement wordt belast, maar een fictief (forfaitair) rendement per vermogenscategorie, boven het heffingsvrij vermogen.",
  },
};

function TaxSection({ r, s, hs }: { r: PlanResult; s: Styles; hs: HouseStyle }) {
  const total = r.taxes.total;
  const colors = [inkOf(hs.primaryColor), hs.secondaryColor, hs.accentColor];
  return (
    <View>
      {total > 0 ? (
        <View style={{ marginBottom: 16 }} wrap={false}>
          <Text style={{ fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 }}>
            Verdeling van {formatEuro(total, { whole: true })} belasting per jaar
          </Text>
          <View style={{ flexDirection: "row", height: 14 }}>
            {r.taxes.lines.map((l, i) =>
              l.tax > 0 ? (
                <View
                  key={l.box}
                  style={{ width: `${(l.tax / total) * 100}%`, backgroundColor: colors[i], borderRightWidth: 1.5, borderRightColor: "#ffffff" }}
                />
              ) : null,
            )}
          </View>
          <View style={{ flexDirection: "row", marginTop: 5 }}>
            {r.taxes.lines.map((l, i) => (
              <View key={l.box} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
                <View style={{ width: 7, height: 7, backgroundColor: colors[i], marginRight: 4 }} />
                <Text style={{ fontSize: 7.5, color: MUTED }}>
                  Box {l.box}: {formatEuro(l.tax, { whole: true })}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {r.taxes.lines.map((l) => (
        <View key={l.box} wrap={false} style={{ marginBottom: 12, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
          <Text style={s.h3}>{l.label}</Text>
          <Text style={{ color: TEXT, marginBottom: 3 }}>{BOX_EXPLANATION[l.box].what}</Text>
          <Text style={{ color: MUTED, marginBottom: 7 }}>{BOX_EXPLANATION[l.box].how}</Text>
          <View style={{ flexDirection: "row" }}>
            {[
              ["Grondslag", formatEuro(l.base, { whole: true })],
              ["Belasting", formatEuro(l.tax, { whole: true })],
              ["Gemiddeld tarief", formatPercent(l.effectiveRate)],
              ["Tarief volgende euro", l.marginalRate > 0 ? formatPercent(l.marginalRate) : "—"],
            ].map(([k, v]) => (
              <View key={k} style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 }}>{k}</Text>
                <Text style={{ fontWeight: 700, fontSize: 10.5, marginTop: 2 }}>{v}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      <View wrap={false} style={{ marginTop: 4 }}>
        <Text style={s.h3}>Gemiddeld tarief en het tarief op de volgende euro</Text>
        <Text style={{ color: MUTED }}>
          Het gemiddelde tarief is de belasting gedeeld door de grondslag: wat u gemiddeld afdraagt. Het tarief op de volgende euro
          laat zien wat een extra euro inkomen in die box kost. Dat tweede getal bepaalt of het loont om inkomen te verschuiven,
          bijvoorbeeld tussen salaris en dividend, of tussen jaren. Over alle boxen samen betaalt u{" "}
          {formatPercent(r.taxes.effectiveRate)} van uw bruto inkomen aan belasting.
        </Text>
      </View>

      {r.taxes.box3.base > 0 ? (
        <View wrap={false} style={{ marginTop: 14 }}>
          <Text style={s.h3}>Zo is de box 3-heffing berekend</Text>
          <Table
            s={s}
            rows={[
              ["Rendementsgrondslag (bezittingen min schulden)", r.taxes.box3.base],
              ["Forfaitair (fictief) rendement", r.taxes.box3.deemedReturn],
              ["Heffingsvrij vermogen", -r.taxes.box3.exemption],
              ["Grondslag sparen en beleggen", r.taxes.box3.taxableBase],
            ]}
            total={["Box 3-belasting", r.taxes.lines.find((l) => l.box === 3)?.tax ?? 0]}
          />
        </View>
      ) : null}
    </View>
  );
}

const SECTION_INTRO: Partial<Record<ReportSectionKey, string>> = {
  vermogensoverzicht: "Een overzicht van wat u bezit en wat u verschuldigd bent, privé en via uw onderneming.",
  inkomsten_uitgaven: "Wat er jaarlijks binnenkomt, wat er na belastingen overblijft en hoe dat zich verhoudt tot uw uitgaven.",
  belastingdruk: "In Nederland wordt inkomen in drie boxen belast, elk met eigen regels. Hieronder ziet u per box wat er wordt belast, hoeveel en waarom.",
  rendementsscenarios: "Hoe uw vermogen zich de komende jaren kan ontwikkelen bij drie verschillende rendementen.",
  zakelijk_overzicht: "De kerncijfers van uw onderneming en hoe die doorwerken in uw privévermogen.",
  aandachtspunten: "Op basis van uw situatie zien wij de volgende kansen en aandachtspunten. Bedragen zijn indicatief en bedoeld als vertrekpunt voor het gesprek.",
  toelichting: "De uitgangspunten achter de berekeningen in dit rapport.",
};

function SectionBody({ k, data, hs, s }: { k: ReportSectionKey; data: ReportData; hs: HouseStyle; s: Styles }) {
  const r = data.result;
  const w = r.wealth;
  switch (k) {
    case "samenvatting":
      return (
        <View>
          <View style={{ marginBottom: 16 }} wrap={false}>
            <Text style={{ fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>Totaal netto vermogen</Text>
            <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 34, lineHeight: 1.25, color: inkOf(hs.primaryColor), marginTop: 2 }}>
              {formatEuro(w.total, { whole: true })}
            </Text>
          </View>
          <Text style={s.lead}>{summaryText(r)}</Text>
          <Tiles
            hs={hs}
            items={[
              { label: "Vermogen privé", value: formatEuro(w.prive.total, { whole: true }) },
              { label: "Vermogen zakelijk", value: formatEuro(w.zakelijk.total, { whole: true }) },
              { label: "Belastingdruk", value: formatPercent(r.taxes.effectiveRate) },
              { label: "Netto inkomen / jaar", value: formatEuro(r.income.net, { whole: true }) },
              { label: "Uitgaven / jaar", value: formatEuro(r.income.expenses, { whole: true }) },
              { label: "Saldo / jaar", value: formatEuro(r.income.balance, { whole: true }) },
            ]}
          />
          {data.insights.length > 0 ? (
            <View style={{ marginTop: 18 }} wrap={false}>
              <Text style={s.h3}>Belangrijkste aandachtspunten</Text>
              {data.insights.slice(0, 3).map((i) => (
                <View key={i.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TONE_COLORS[i.tone], marginRight: 8 }} />
                  <Text style={{ flex: 1 }}>{i.title}</Text>
                  {i.amount ? <Text style={{ color: MUTED }}>{formatEuro(i.amount.value, { whole: true })}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      );
    case "vermogensoverzicht":
      return (
        <View>
          <Text style={s.h3}>Privé</Text>
          <Table
            s={s}
            rows={[
              ["Eigen woning (WOZ-waarde)", w.prive.eigenWoningValue],
              ["Hypotheek", -w.prive.mortgageDebt],
              ["Bezittingen box 3", w.prive.box3Assets],
              ["Schulden box 3", -w.prive.box3Debts],
            ]}
            total={["Netto vermogen privé", w.prive.total]}
          />
          {w.zakelijk.total !== 0 || w.zakelijk.companies.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <Text style={s.h3}>Zakelijk</Text>
              <Table s={s} rows={[["Aandelen BV (indicatieve waarde)", w.zakelijk.shareValue]]} total={["Netto vermogen zakelijk", w.zakelijk.total]} />
            </View>
          ) : null}
          <View style={{ marginTop: 14, flexDirection: "row", justifyContent: "space-between", backgroundColor: PAPER, paddingVertical: 10, paddingHorizontal: 12 }} wrap={false}>
            <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 12 }}>Totaal netto vermogen</Text>
            <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 12, color: inkOf(hs.primaryColor) }}>
              {formatEuro(w.total, { whole: true })}
            </Text>
          </View>
          <Bars
            color={inkOf(hs.primaryColor)}
            data={[
              { label: "Eigen woning (netto)", value: w.prive.eigenWoningNet },
              { label: "Box 3 (netto)", value: w.prive.box3Net },
              { label: "Aandelen BV", value: w.zakelijk.shareValue },
            ]}
          />
        </View>
      );
    case "inkomsten_uitgaven":
      return (
        <View>
          <Table
            s={s}
            rows={[
              ["Bruto inkomen uit arbeid", r.income.grossEmployment],
              ["Salaris uit eigen BV", r.income.dgaSalary],
              ["Ontvangen dividend", r.income.dividendReceived],
              ["Belastingen (box 1, 2 en 3)", -r.income.taxTotal],
              ["Netto inkomen", r.income.net],
              ["Uitgaven huishouden", -r.income.expenses],
            ]}
            total={["Saldo per jaar", r.income.balance]}
          />
          <Bars
            color={hs.secondaryColor}
            data={[
              { label: "Netto inkomen", value: r.income.net },
              { label: "Uitgaven", value: r.income.expenses },
              { label: "Saldo", value: r.income.balance },
            ]}
          />
        </View>
      );
    case "belastingdruk":
      return <TaxSection r={r} s={s} hs={hs} />;
    case "rendementsscenarios":
      return (
        <View>
          <ProjectionChart result={r} hs={hs} />
          <View style={{ marginTop: 14 }}>
            <View style={[s.row, { borderBottomColor: TEXT }]}>
              <Text style={[s.cellLabel, s.bold]}>Jaar</Text>
              <Text style={[s.cellValue, s.bold]}>Pessimistisch</Text>
              <Text style={[s.cellValue, s.bold]}>Neutraal</Text>
              <Text style={[s.cellValue, s.bold]}>Optimistisch</Text>
            </View>
            {r.projection.points
              .filter((_, i) => i % 5 === 0)
              .map((p) => (
                <View key={p.year} style={s.row} wrap={false}>
                  <Text style={s.cellLabel}>
                    {p.year}
                    {p.age ? `  (${p.age} jaar)` : ""}
                  </Text>
                  <Text style={s.cellValue}>{formatEuro(p.pessimistisch, { whole: true })}</Text>
                  <Text style={[s.cellValue, s.bold]}>{formatEuro(p.neutraal, { whole: true })}</Text>
                  <Text style={s.cellValue}>{formatEuro(p.optimistisch, { whole: true })}</Text>
                </View>
              ))}
          </View>
        </View>
      );
    case "zakelijk_overzicht":
      return w.zakelijk.companies.length === 0 ? (
        <Text style={s.lead}>Dit plan bevat geen zakelijke onderdelen.</Text>
      ) : (
        <View>
          {w.zakelijk.companies.map((c) => (
            <View key={c.name || "bv"} style={s.section}>
              <Text style={s.h3}>
                {c.name || "BV"} · {c.sharePercentage}% aandelenbezit
              </Text>
              <Table
                s={s}
                rows={[
                  ["Eigen vermogen BV", w.zakelijk.equity],
                  ["Liquide middelen BV", w.zakelijk.liquidAssets],
                  ["Resultaat na belasting", c.resultAfterTax],
                  ["Dividenduitkering", c.dividend],
                  ["Salaris uit de BV", c.dgaSalary],
                  ["Oudedagsverplichting / pensioen in eigen beheer", w.zakelijk.pensionObligation],
                ]}
                total={["Indicatieve waarde aandelen", w.zakelijk.shareValue]}
              />
            </View>
          ))}
        </View>
      );
    case "aandachtspunten":
      return data.insights.length === 0 ? (
        <Text style={s.lead}>Op basis van de ingevulde gegevens zijn er geen bijzondere aandachtspunten.</Text>
      ) : (
        <View>
          {data.insights.map((i) => (
            <InsightCard key={i.id} insight={i} hs={hs} />
          ))}
        </View>
      );
    case "toelichting":
      return (
        <View>
          <Text style={{ marginBottom: 7 }}>
            Dit rapport is opgesteld op basis van de gegevens die bij {data.firmName} bekend waren op {formatDate(data.generatedAt)}.
            Bedragen zijn afgerond en indicatief.
          </Text>
          <Text style={{ marginBottom: 7 }}>
            Inflatie, rendementen en belastingtarieven zijn vereenvoudigd ({r.engine.assumptionsLabel}). Er is geen rekening
            gehouden met heffingskortingen, toeslagen en persoonlijke aftrekposten. De scenario&apos;s zijn geen voorspelling:
            werkelijke rendementen kunnen hoger of lager uitvallen.
          </Text>
          <Text style={{ color: MUTED, fontSize: 8.5 }}>
            Deze berekening is gemaakt met een prototype-rekenkern ({r.engine.name} v{r.engine.version}) en is niet geschikt als
            financieel advies.
          </Text>
        </View>
      );
  }
}

// --- cover & contents ----------------------------------------------------------------

function Cover({ data, hs, logo }: { data: ReportData; hs: HouseStyle; logo?: ReportLogo | null }) {
  const v = hs.layoutVariant;
  const on = onColor(hs.primaryColor);
  const meta = [
    ["Opgesteld voor", [data.clientName, data.companyName].filter(Boolean).join(" · ")],
    ["Datum", formatDate(data.generatedAt)],
    ["Adviseur", [data.plannerName, data.firmName].filter(Boolean).join(", ")],
  ];

  if (v === "modern") {
    return (
      <Page size="A4" style={{ fontFamily: hs.fontBody, color: TEXT, backgroundColor: "#ffffff" }}>
        <View style={{ backgroundColor: hs.primaryColor, height: "66%", paddingHorizontal: 52, paddingTop: 52, paddingBottom: 46, justifyContent: "space-between", position: "relative" }}>
          <Svg width={595} height={556} style={{ position: "absolute", top: 0, left: 0 }}>
            <Circle cx={520} cy={120} r={190} fill={hs.secondaryColor} fillOpacity={0.35} />
            <Circle cx={600} cy={330} r={150} fill={hs.accentColor} fillOpacity={0.55} />
            <Circle cx={455} cy={300} r={46} fill={hs.accentColor} fillOpacity={0.9} />
          </Svg>
          <View style={{ color: on.text }}>
            <LogoPlate logo={logo} firmName={data.firmName} hs={hs} />
          </View>
          <View>
            <View style={{ width: 44, height: 4, backgroundColor: hs.accentColor, marginBottom: 16 }} />
            <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 42, color: on.text, lineHeight: 1.08 }}>Financieel{"\n"}plan</Text>
            <Text style={{ fontSize: 13, color: on.soft, marginTop: 10 }}>{data.planTitle}</Text>
          </View>
        </View>
        <View style={{ paddingHorizontal: 52, paddingTop: 34, flexDirection: "row" }}>
          {meta.map(([k, val]) => (
            <View key={k} style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</Text>
              <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 11.5, marginTop: 4, lineHeight: 1.3 }}>{val}</Text>
            </View>
          ))}
        </View>
        <Text style={{ position: "absolute", bottom: 40, left: 52, fontSize: 7.5, color: SUBTLE }}>Vertrouwelijk</Text>
      </Page>
    );
  }

  if (v === "minimalistisch") {
    return (
      <Page size="A4" style={{ fontFamily: hs.fontBody, color: TEXT, flexDirection: "row", backgroundColor: "#ffffff" }}>
        <View style={{ width: "36%", backgroundColor: hs.primaryColor, padding: 40, justifyContent: "space-between", color: on.text }}>
          <LogoPlate logo={logo} firmName={data.firmName} hs={hs} />
          <View>
            <View style={{ width: 24, height: 2, backgroundColor: hs.accentColor, marginBottom: 10 }} />
            <Text style={{ fontSize: 8, color: on.soft, lineHeight: 1.6 }}>{data.firmName}</Text>
            {data.plannerName ? <Text style={{ fontSize: 8, color: on.soft }}>{data.plannerName}</Text> : null}
          </View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 48, paddingVertical: 64, justifyContent: "center" }}>
          <Text style={{ fontSize: 8, color: SUBTLE, letterSpacing: 2.5, textTransform: "uppercase" }}>Financieel plan</Text>
          <Text style={{ fontFamily: hs.fontHeading, fontSize: 34, color: TEXT, marginTop: 10, lineHeight: 1.12 }}>{data.planTitle}</Text>
          <View style={{ width: 36, height: 1.5, backgroundColor: hs.primaryColor, marginVertical: 22 }} />
          <Text style={{ fontSize: 13 }}>{data.clientName}</Text>
          {data.companyName ? <Text style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{data.companyName}</Text> : null}
          <Text style={{ fontSize: 9, color: SUBTLE, marginTop: 22 }}>{formatDate(data.generatedAt)}</Text>
        </View>
      </Page>
    );
  }

  // klassiek: full-colour page with an inset frame
  return (
    <Page size="A4" style={{ fontFamily: hs.fontBody, backgroundColor: hs.primaryColor, padding: 30 }}>
      <View style={{ flex: 1, borderWidth: 0.75, borderColor: hs.accentColor, paddingHorizontal: 40, paddingVertical: 44, alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ alignItems: "center", color: on.text }}>
          <LogoPlate logo={logo} firmName={data.firmName} hs={hs} />
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 8.5, color: hs.accentColor, letterSpacing: 3, textTransform: "uppercase" }}>Financieel plan</Text>
          <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 34, color: on.text, marginTop: 14, textAlign: "center", lineHeight: 1.15 }}>
            {data.planTitle}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
            <View style={{ width: 34, height: 0.75, backgroundColor: hs.accentColor }} />
            <View style={{ width: 5, height: 5, backgroundColor: hs.accentColor, marginHorizontal: 8, transform: "rotate(45deg)" }} />
            <View style={{ width: 34, height: 0.75, backgroundColor: hs.accentColor }} />
          </View>
          <Text style={{ fontFamily: hs.fontHeading, fontSize: 16, color: on.text }}>{data.clientName}</Text>
          {data.companyName ? <Text style={{ fontSize: 10.5, color: on.soft, marginTop: 4 }}>{data.companyName}</Text> : null}
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 8.5, color: on.soft }}>{[data.plannerName, data.firmName].filter(Boolean).join(" · ")}</Text>
          <Text style={{ fontSize: 8.5, color: on.soft, marginTop: 3 }}>{formatDate(data.generatedAt)}</Text>
        </View>
      </View>
    </Page>
  );
}

function Contents({ data, hs, pages, s }: { data: ReportData; hs: HouseStyle; pages?: SectionPages; s: Styles }) {
  const ink = inkOf(hs.primaryColor);
  const labels = new Map(REPORT_SECTIONS.map((r) => [r.key, r.label]));
  return (
    <View>
      <Text style={{ fontSize: 7.5, color: SUBTLE, letterSpacing: 2, textTransform: "uppercase" }}>Inhoud</Text>
      <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 26, color: ink, marginTop: 6, marginBottom: 24 }}>
        In dit rapport
      </Text>
      {data.sections.map((k, i) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "flex-end", paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: RULE }}>
          <Text style={{ fontFamily: hs.fontHeading, fontSize: 10, color: hs.accentColor, width: 30 }}>{String(i + 1).padStart(2, "0")}</Text>
          <Text style={{ fontFamily: hs.fontHeading, fontSize: 12.5, flex: 1 }}>{labels.get(k)}</Text>
          <Text style={{ fontSize: 10, color: MUTED }}>{pages?.[k] ?? ""}</Text>
        </View>
      ))}
      <View style={{ marginTop: 34, backgroundColor: hs.layoutVariant === "minimalistisch" ? "#ffffff" : PAPER, padding: 16, borderLeftWidth: 2, borderLeftColor: hs.accentColor }}>
        <Text style={s.h3}>Over dit rapport</Text>
        <Text style={{ color: MUTED }}>
          Dit rapport geeft een overzicht van uw financiële situatie: uw vermogen, inkomsten, belastingen en de verwachte
          ontwikkeling naar de toekomst. De cijfers zijn een momentopname op {formatDate(data.generatedAt)} en vormen de basis voor
          het gesprek met {data.plannerName ?? "uw adviseur"} van {withFullStop(data.firmName)}
        </Text>
      </View>
    </View>
  );
}

function PageChrome({ data, hs, logo }: { data: ReportData; hs: HouseStyle; logo?: ReportLogo | null }) {
  return (
    <>
      <View
        fixed
        style={{
          position: "absolute",
          top: 30,
          left: 56,
          right: 56,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingBottom: 8,
          borderBottomWidth: 0.5,
          borderBottomColor: RULE,
          color: inkOf(hs.primaryColor),
        }}
      >
        <LogoPlate logo={logo} firmName={data.firmName} hs={hs} size="sm" />
        <Text style={{ fontSize: 7.5, color: MUTED }}>
          {data.clientName} · {data.planTitle}
        </Text>
      </View>
      <View fixed style={{ position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 5, height: 5, backgroundColor: hs.accentColor, marginRight: 6 }} />
          <Text style={{ fontSize: 7, color: SUBTLE }}>Vertrouwelijk · {data.firmName}</Text>
        </View>
        <Text style={{ fontSize: 7, color: SUBTLE }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

export function ReportDocument({
  data,
  style,
  logo,
  sectionPages,
  onSectionPage,
}: {
  data: ReportData;
  style: HouseStyle;
  logo?: ReportLogo | null;
  sectionPages?: SectionPages;
  onSectionPage?: (key: ReportSectionKey, page: number) => void;
}) {
  const s = makeStyles(style);
  const labels = new Map(REPORT_SECTIONS.map((r) => [r.key, r.label]));
  return (
    <Document title={`${data.planTitle} — ${data.clientName}`} author={data.firmName} creator="Plannr" language="nl">
      <Cover data={data} hs={style} logo={logo} />
      <Page size="A4" style={s.page}>
        <PageChrome data={data} hs={style} logo={logo} />
        <Contents data={data} hs={style} pages={sectionPages} s={s} />
      </Page>
      {data.sections.map((k, i) => (
        <Page key={k} size="A4" style={s.page} wrap>
          <PageChrome data={data} hs={style} logo={logo} />
          {onSectionPage ? (
            // Records the page each section starts on (first render pass only).
            <Text
              fixed
              style={{ position: "absolute", top: 0, left: 0, fontSize: 1 }}
              render={({ pageNumber, subPageNumber }) => {
                if (subPageNumber === 1) onSectionPage(k, pageNumber);
                return "";
              }}
            />
          ) : null}
          <SectionOpener number={i + 1} title={labels.get(k) ?? k} intro={SECTION_INTRO[k]} hs={style} />
          <SectionBody k={k} data={data} hs={style} s={s} />
        </Page>
      ))}
    </Document>
  );
}
