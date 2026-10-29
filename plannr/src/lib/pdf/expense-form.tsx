// Printable expense form in the firm's house style (same categories as the
// Excel sheet and the Uitgaven step), for clients who prefer paper.

import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { EXPENSE_CATEGORIES, EXPENSE_GROUPS } from "@/lib/plan/expenses";
import type { HouseStyle } from "@/lib/house-style/types";
import type { ReportLogo } from "./report";

const TEXT = "#1F2328";
const MUTED = "#5B616B";
const RULE = "#C9CDD3";

export function ExpenseFormDocument({ firmName, style, logo }: { firmName: string; style: HouseStyle; logo?: ReportLogo | null }) {
  const blank = (width: number) => <View style={{ width, borderBottomWidth: 0.75, borderBottomColor: RULE, height: 14 }} />;
  return (
    <Document title="Uitgavenoverzicht" author={firmName} creator="Plannr" language="nl">
      <Page size="A4" style={{ fontFamily: style.fontBody, fontSize: 9, color: TEXT, paddingHorizontal: 48, paddingTop: 40, paddingBottom: 48 }} wrap>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          {logo ? (
            <Image src={{ data: logo.data, format: logo.format }} style={{ maxHeight: 34, maxWidth: 150, objectFit: "contain" }} />
          ) : (
            <Text style={{ fontFamily: style.fontHeading, fontWeight: 700, fontSize: 12, color: style.primaryColor }}>{firmName}</Text>
          )}
          <View style={{ width: 40, height: 3, backgroundColor: style.accentColor }} />
        </View>
        <Text style={{ fontFamily: style.fontHeading, fontWeight: 700, fontSize: 22, color: style.primaryColor }}>Uitgavenoverzicht</Text>
        <Text style={{ color: MUTED, marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
          Vul per post het bedrag per maand in. Uitgaven die niet maandelijks zijn (zoals vakanties of kleding)? Deel het jaarbedrag door 12.
        </Text>
        <View style={{ flexDirection: "row", gap: 24, marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
            <Text style={{ fontWeight: 700 }}>Naam</Text>
            {blank(190)}
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
            <Text style={{ fontWeight: 700 }}>Datum</Text>
            {blank(100)}
          </View>
        </View>

        {EXPENSE_GROUPS.map((g) => (
          <View key={g.key} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1.25, borderBottomColor: style.accentColor, paddingBottom: 3, marginBottom: 4 }} wrap={false}>
              <Text style={{ fontFamily: style.fontHeading, fontWeight: 700, fontSize: 11, color: style.primaryColor }}>{g.label}</Text>
              <Text style={{ color: MUTED, fontSize: 8 }}>per maand</Text>
            </View>
            {EXPENSE_CATEGORIES.filter((c) => c.group === g.key).map((c) => (
              <View key={c.key} style={{ marginBottom: 4 }} wrap={false}>
                <Text style={{ fontWeight: 700, marginTop: 3 }}>{c.label}</Text>
                {c.items.map((item) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingLeft: 10, marginTop: 3 }}>
                    <Text style={{ color: MUTED }}>{item}</Text>
                    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: MUTED }}>€</Text>
                      {blank(80)}
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", backgroundColor: style.primaryColor, padding: 10, marginTop: 6 }} wrap={false}>
          <Text style={{ fontFamily: style.fontHeading, fontWeight: 700, fontSize: 11, color: "#FFFFFF" }}>Totaal per maand</Text>
          <View style={{ width: 96, borderBottomWidth: 0.75, borderBottomColor: "#FFFFFF", height: 14 }} />
        </View>
        <Text fixed style={{ position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 7, color: MUTED }} render={({ pageNumber, totalPages }) => `${firmName} · vertrouwelijk · ${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}
