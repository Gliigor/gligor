// Client-facing PDF report, rendered server-side with React-PDF in the firm's
// house style. All numbers come from a PlanResult (i.e. from calculatePlan()).

import { Document, Image, Page, Polyline, StyleSheet, Svg, Line as SvgLine, Text, View } from "@react-pdf/renderer";
import type { PlanResult } from "@/lib/engine/types";
import type { HouseStyle } from "@/lib/house-style/types";
import type { ReportSectionKey } from "@/lib/plan/definitions";
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
}

export interface ReportLogo {
  data: Buffer;
  format: "png" | "jpg";
}

const TEXT = "#1f2328";
const MUTED = "#5b6472";
const RULE = "#e3e6ea";
const NEGATIVE = "#b42323";

/** Mixes a hex color with white. amount 0 = color, 1 = white. */
export function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function makeStyles(hs: HouseStyle) {
  const v = hs.layoutVariant;
  return StyleSheet.create({
    page: {
      fontFamily: hs.fontBody,
      fontSize: 10,
      color: TEXT,
      paddingTop: v === "minimalistisch" ? 64 : 56,
      paddingBottom: 64,
      paddingHorizontal: v === "minimalistisch" ? 64 : 52,
      lineHeight: 1.45,
    },
    h2: {
      fontFamily: hs.fontHeading,
      fontWeight: 700,
      fontSize: v === "minimalistisch" ? 11 : 16,
      color: hs.primaryColor,
      textTransform: v === "minimalistisch" ? "uppercase" : "none",
      letterSpacing: v === "minimalistisch" ? 1.5 : 0,
      marginBottom: 10,
      ...(v === "klassiek" ? { paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: hs.primaryColor } : {}),
      ...(v === "modern" ? { paddingLeft: 8, borderLeftWidth: 4, borderLeftColor: hs.accentColor } : {}),
    },
    section: { marginBottom: 22 },
    lead: { color: MUTED, marginBottom: 10 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: RULE },
    rowTotal: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, marginTop: 2 },
    cellLabel: { flex: 1, paddingRight: 8 },
    cellValue: { width: 110, textAlign: "right" },
    bold: { fontWeight: 700 },
    footer: {
      position: "absolute",
      bottom: 28,
      left: v === "minimalistisch" ? 64 : 52,
      right: v === "minimalistisch" ? 64 : 52,
      flexDirection: "row",
      justifyContent: "space-between",
      fontSize: 7.5,
      color: MUTED,
      borderTopWidth: v === "minimalistisch" ? 0 : 0.5,
      borderTopColor: RULE,
      paddingTop: 6,
    },
  });
}

type Styles = ReturnType<typeof makeStyles>;

// --- building blocks -------------------------------------------------------

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
    <View style={{ marginTop: 8 }}>
      {data.map((d) => (
        <View key={d.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }} wrap={false}>
          <Text style={{ width: 120, fontSize: 9, color: MUTED }}>{d.label}</Text>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: `${Math.max(1, (Math.abs(d.value) / max) * 100)}%`,
                maxWidth: "78%",
                height: 12,
                backgroundColor: d.value < 0 ? NEGATIVE : color,
                borderTopRightRadius: 3,
                borderBottomRightRadius: 3,
              }}
            />
            <Text style={{ fontSize: 9, marginLeft: 6 }}>{formatEuroCompact(d.value)}</Text>
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
              padding: 10,
              borderRadius: v === "modern" ? 6 : 2,
              backgroundColor: v === "modern" ? tint(hs.primaryColor, 0.9) : v === "klassiek" ? "#f7f7f5" : "#ffffff",
              borderWidth: v === "minimalistisch" ? 0.5 : 0,
              borderColor: RULE,
            }}
          >
            <Text style={{ fontSize: 8, color: MUTED }}>{t.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700, color: v === "minimalistisch" ? TEXT : hs.primaryColor, marginTop: 2 }}>
              {t.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ProjectionChart({ result, hs }: { result: PlanResult; hs: HouseStyle }) {
  const W = 490;
  const H = 190;
  const padL = 56;
  const padR = 64;
  const padT = 8;
  const padB = 20;
  const pts = result.projection.points;
  const keys = ["optimistisch", "neutraal", "pessimistisch"] as const;
  const colors = { optimistisch: hs.accentColor, neutraal: hs.primaryColor, pessimistisch: hs.secondaryColor };
  const values = pts.flatMap((p) => keys.map((k) => p[k]));
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const x = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const sc = result.projection.scenarios;

  return (
    <View wrap={false}>
      <View style={{ flexDirection: "row", marginBottom: 6 }}>
        {keys.map((k) => (
          <View key={k} style={{ flexDirection: "row", alignItems: "center", marginRight: 14 }}>
            <View style={{ width: 12, height: 2, backgroundColor: colors[k], marginRight: 4 }} />
            <Text style={{ fontSize: 8, color: MUTED }}>
              {sc[k].label} ({formatPercent(sc[k].returnRate)})
            </Text>
          </View>
        ))}
      </View>
      <Svg width={W} height={H}>
        {ticks.map((t) => (
          <SvgLine key={t} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={RULE} strokeWidth={0.5} />
        ))}
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
            strokeWidth={k === "neutraal" ? 2 : 1.5}
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

// --- sections ----------------------------------------------------------------

function summaryText(r: PlanResult): string {
  const parts = [
    `Het totale netto vermogen bedraagt ${formatEuro(r.wealth.total, { whole: true })}, waarvan ${formatEuro(r.wealth.prive.total, { whole: true })} privé en ${formatEuro(r.wealth.zakelijk.total, { whole: true })} zakelijk.`,
  ];
  if (r.income.expenses > 0) {
    parts.push(
      r.income.balance >= 0
        ? `Na belasting en uitgaven resteert jaarlijks ongeveer ${formatEuro(r.income.balance, { whole: true })}.`
        : `De jaarlijkse uitgaven zijn ongeveer ${formatEuro(-r.income.balance, { whole: true })} hoger dan het netto inkomen.`,
    );
  }
  const last = r.projection.points[r.projection.points.length - 1];
  if (last) {
    parts.push(
      `In het neutrale scenario groeit het vermogen naar circa ${formatEuro(last.neutraal, { whole: true })} in ${last.year} (${formatEuro(last.neutraalReeel, { whole: true })} in de koopkracht van vandaag).`,
    );
  }
  return parts.join(" ");
}

function Sections({ data, hs, s }: { data: ReportData; hs: HouseStyle; s: Styles }) {
  const r = data.result;
  const w = r.wealth;
  const blocks: Record<ReportSectionKey, React.ReactNode> = {
    samenvatting: (
      <View style={s.section} key="samenvatting">
        <Text style={s.h2} minPresenceAhead={120}>Samenvatting</Text>
        <Text style={s.lead}>{summaryText(r)}</Text>
        <Tiles
          hs={hs}
          items={[
            { label: "Totaal vermogen", value: formatEuro(w.total, { whole: true }) },
            { label: "Vermogen privé", value: formatEuro(w.prive.total, { whole: true }) },
            { label: "Vermogen zakelijk", value: formatEuro(w.zakelijk.total, { whole: true }) },
            { label: "Netto inkomen per jaar", value: formatEuro(r.income.net, { whole: true }) },
            { label: "Jaarlijks saldo", value: formatEuro(r.income.balance, { whole: true }) },
            { label: "Belastingdruk", value: formatPercent(r.taxes.effectiveRate) },
          ]}
        />
      </View>
    ),
    vermogensoverzicht: (
      <View style={s.section} key="vermogensoverzicht">
        <Text style={s.h2} minPresenceAhead={120}>Vermogensoverzicht</Text>
        <Table
          s={s}
          rows={[
            ["Eigen woning (WOZ-waarde)", w.prive.eigenWoningValue],
            ["Hypotheek", -w.prive.mortgageDebt],
            ["Bezittingen box 3", w.prive.box3Assets],
            ["Schulden box 3", -w.prive.box3Debts],
            ["Aandelen BV (indicatief)", w.zakelijk.shareValue],
          ]}
          total={["Totaal netto vermogen", w.total]}
        />
        <Bars
          color={hs.primaryColor}
          data={[
            { label: "Eigen woning (netto)", value: w.prive.eigenWoningNet },
            { label: "Box 3 (netto)", value: w.prive.box3Net },
            { label: "Aandelen BV", value: w.zakelijk.shareValue },
          ]}
        />
      </View>
    ),
    inkomsten_uitgaven: (
      <View style={s.section} key="inkomsten_uitgaven" wrap={false}>
        <Text style={s.h2} minPresenceAhead={120}>Inkomsten en uitgaven</Text>
        <Table
          s={s}
          rows={[
            ["Bruto inkomen uit arbeid", r.income.grossEmployment],
            ["Salaris DGA", r.income.dgaSalary],
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
    ),
    belastingdruk: (
      <View style={s.section} key="belastingdruk" wrap={false}>
        <Text style={s.h2} minPresenceAhead={120}>Belastingdruk per box</Text>
        <Text style={s.lead}>Indicatie van de belasting per box in het referentiejaar {r.referenceYear}.</Text>
        <Table s={s} rows={r.taxes.lines.map((l) => [l.label, l.tax])} total={["Totaal", r.taxes.total]} />
        <Text style={{ marginTop: 6, color: MUTED }}>
          Effectieve belastingdruk: {formatPercent(r.taxes.effectiveRate)} van het bruto inkomen.
        </Text>
      </View>
    ),
    rendementsscenarios: (
      <View style={s.section} key="rendementsscenarios">
        <View wrap={false}>
          <Text style={s.h2}>Rendementsscenario&apos;s</Text>
          <Text style={s.lead}>
            Verwachte ontwikkeling van het totale netto vermogen over {r.projection.points.length - 1} jaar in drie
            scenario&apos;s
            {r.retirement.retirementYear ? `, met pensionering in ${r.retirement.retirementYear}` : ""}.
          </Text>
          <ProjectionChart result={r} hs={hs} />
        </View>
        <View style={{ marginTop: 10 }}>
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
                  {p.age ? ` (${p.age} jr)` : ""}
                </Text>
                <Text style={s.cellValue}>{formatEuro(p.pessimistisch, { whole: true })}</Text>
                <Text style={s.cellValue}>{formatEuro(p.neutraal, { whole: true })}</Text>
                <Text style={s.cellValue}>{formatEuro(p.optimistisch, { whole: true })}</Text>
              </View>
            ))}
        </View>
      </View>
    ),
    zakelijk_overzicht: (
      <View style={s.section} key="zakelijk_overzicht" wrap={false}>
        <Text style={s.h2} minPresenceAhead={120}>Zakelijk overzicht</Text>
        {w.zakelijk.companies.length === 0 ? (
          <Text style={s.lead}>Dit plan bevat geen zakelijke onderdelen.</Text>
        ) : (
          w.zakelijk.companies.map((c) => (
            <View key={c.name || "bv"}>
              <Text style={[s.bold, { marginBottom: 4 }]}>
                {c.name || "BV"} — {c.sharePercentage}% aandelenbezit
              </Text>
              <Table
                s={s}
                rows={[
                  ["Eigen vermogen BV", w.zakelijk.equity],
                  ["Liquide middelen BV", w.zakelijk.liquidAssets],
                  ["Resultaat na belasting", c.resultAfterTax],
                  ["Dividenduitkering", c.dividend],
                  ["Salaris DGA", c.dgaSalary],
                  ["Pensioen in eigen beheer / ODV", w.zakelijk.pensionObligation],
                ]}
                total={["Indicatieve waarde aandelen", w.zakelijk.shareValue]}
              />
            </View>
          ))
        )}
      </View>
    ),
    toelichting: (
      <View style={s.section} key="toelichting" wrap={false}>
        <Text style={s.h2} minPresenceAhead={120}>Toelichting en uitgangspunten</Text>
        <Text style={{ marginBottom: 6 }}>
          Dit rapport is opgesteld op basis van de gegevens die bij {data.firmName} bekend waren op{" "}
          {formatDate(data.generatedAt)}. Bedragen zijn afgerond en indicatief.
        </Text>
        <Text style={{ marginBottom: 6 }}>
          Uitgangspunten: inflatie, rendementen en belastingtarieven zijn vereenvoudigd ({r.engine.assumptionsLabel}). Er is
          geen rekening gehouden met heffingskortingen, toeslagen en persoonlijke aftrekposten.
        </Text>
        <Text style={{ color: MUTED, fontSize: 8.5 }}>
          Let op: deze berekening is gemaakt met een prototype-rekenkern ({r.engine.name} v{r.engine.version}) en is niet
          geschikt als financieel advies.
        </Text>
      </View>
    ),
  };
  const ordered = ["samenvatting", "vermogensoverzicht", "inkomsten_uitgaven", "belastingdruk", "rendementsscenarios", "zakelijk_overzicht", "toelichting"] as const;
  return <>{ordered.filter((k) => data.sections.includes(k)).map((k) => blocks[k])}</>;
}

// --- cover -------------------------------------------------------------------

function Cover({ data, hs, logo }: { data: ReportData; hs: HouseStyle; logo?: ReportLogo | null }) {
  const v = hs.layoutVariant;
  // React-PDF's Image has no alt attribute (PDF images are not HTML).
  // eslint-disable-next-line jsx-a11y/alt-text
  const logoEl = logo ? <Image src={logo} style={{ maxWidth: 150, maxHeight: 56, objectFit: "contain" }} /> : (
    <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 14, color: v === "modern" ? "#ffffff" : hs.primaryColor }}>
      {data.firmName}
    </Text>
  );
  const subtitle = [data.clientName, data.companyName].filter(Boolean).join(" · ");

  if (v === "modern") {
    return (
      <Page size="A4" style={{ fontFamily: hs.fontBody, color: TEXT }}>
        <View style={{ backgroundColor: hs.primaryColor, height: "58%", padding: 52, justifyContent: "space-between" }}>
          <View style={logo ? { backgroundColor: "#ffffff", padding: 10, borderRadius: 6, alignSelf: "flex-start" } : {}}>{logoEl}</View>
          <View>
            <View style={{ width: 48, height: 4, backgroundColor: hs.accentColor, marginBottom: 14 }} />
            <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 32, color: "#ffffff", lineHeight: 1.15 }}>
              Financieel plan
            </Text>
            <Text style={{ fontSize: 14, color: tint(hs.primaryColor, 0.75), marginTop: 6 }}>{data.planTitle}</Text>
          </View>
        </View>
        <View style={{ padding: 52 }}>
          <Text style={{ fontSize: 9, color: MUTED }}>Opgesteld voor</Text>
          <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 18, marginTop: 2 }}>{subtitle}</Text>
          <Text style={{ fontSize: 9, color: MUTED, marginTop: 18 }}>Datum</Text>
          <Text style={{ fontSize: 12, marginTop: 2 }}>{formatDate(data.generatedAt)}</Text>
          {data.plannerName ? (
            <>
              <Text style={{ fontSize: 9, color: MUTED, marginTop: 18 }}>Financieel planner</Text>
              <Text style={{ fontSize: 12, marginTop: 2 }}>
                {data.plannerName}, {data.firmName}
              </Text>
            </>
          ) : null}
        </View>
      </Page>
    );
  }

  if (v === "minimalistisch") {
    return (
      <Page size="A4" style={{ fontFamily: hs.fontBody, color: TEXT, padding: 72, justifyContent: "space-between" }}>
        <View>{logoEl}</View>
        <View>
          <Text style={{ fontFamily: hs.fontHeading, fontSize: 30, lineHeight: 1.2 }}>{data.planTitle}</Text>
          <View style={{ width: 32, height: 1.5, backgroundColor: hs.primaryColor, marginVertical: 16 }} />
          <Text style={{ fontSize: 12 }}>{subtitle}</Text>
          <Text style={{ fontSize: 10, color: MUTED, marginTop: 4 }}>{formatDate(data.generatedAt)}</Text>
        </View>
        <Text style={{ fontSize: 8, color: MUTED }}>
          {data.firmName}
          {data.plannerName ? ` · ${data.plannerName}` : ""}
        </Text>
      </Page>
    );
  }

  // klassiek
  return (
    <Page size="A4" style={{ fontFamily: hs.fontBody, color: TEXT, padding: 56 }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: hs.primaryColor, paddingBottom: 14 }}>{logoEl}</View>
      <View style={{ marginTop: 200, alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>Financieel plan</Text>
        <Text style={{ fontFamily: hs.fontHeading, fontWeight: 700, fontSize: 28, color: hs.primaryColor, marginTop: 10, textAlign: "center" }}>
          {data.planTitle}
        </Text>
        <View style={{ width: 60, height: 2, backgroundColor: hs.accentColor, marginVertical: 18 }} />
        <Text style={{ fontSize: 14 }}>{data.clientName}</Text>
        {data.companyName ? <Text style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{data.companyName}</Text> : null}
      </View>
      <View style={{ position: "absolute", bottom: 56, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontSize: 9, color: MUTED }}>
        <Text>
          {data.firmName}
          {data.plannerName ? ` · ${data.plannerName}` : ""}
        </Text>
        <Text>{formatDate(data.generatedAt)}</Text>
      </View>
    </Page>
  );
}

export function ReportDocument({ data, style, logo }: { data: ReportData; style: HouseStyle; logo?: ReportLogo | null }) {
  const s = makeStyles(style);
  return (
    <Document title={`${data.planTitle} — ${data.clientName}`} author={data.firmName} creator="Plannr" language="nl">
      <Cover data={data} hs={style} logo={logo} />
      <Page size="A4" style={s.page} wrap>
        {data.sections.length === 0 ? <Text style={s.lead}>Er zijn geen rapportonderdelen geselecteerd.</Text> : null}
        <Sections data={data} hs={style} s={s} />
        <View style={s.footer} fixed>
          <Text>
            {data.firmName} · {data.planTitle}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} van ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
