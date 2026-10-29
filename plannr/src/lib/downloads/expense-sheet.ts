import "server-only";

// The expense sheet a planner sends to a client: an Excel workbook in the
// firm's house style, with the same categories as the Uitgaven step, so the
// subtotals can be copied straight into the plan.

import ExcelJS from "exceljs";
import { EXPENSE_CATEGORIES, EXPENSE_GROUPS } from "@/lib/plan/expenses";
import type { HouseStyle } from "@/lib/house-style/types";
import type { ReportLogo } from "@/lib/pdf/report";

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

function tint(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** White or dark text on a background colour. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#1F2328" : "#FFFFFF";
}

const EURO = '€ #,##0;[Red]-€ #,##0;"–"';

export async function buildExpenseSheet(opts: { firmName: string; style: HouseStyle; logo: ReportLogo | null }): Promise<Buffer> {
  const { firmName, style, logo } = opts;
  const wb = new ExcelJS.Workbook();
  wb.creator = firmName;
  wb.title = "Uitgavenoverzicht";

  const ws = wb.addWorksheet("Uitgaven", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
  });
  ws.columns = [
    { key: "post", width: 38 },
    { key: "toelichting", width: 34 },
    { key: "maand", width: 15 },
    { key: "jaar", width: 15 },
  ];
  const font = { name: "Calibri", size: 11, color: { argb: "FF1F2328" } };
  const primary = style.primaryColor;
  const accent = style.accentColor;
  const thin = { style: "thin" as const, color: { argb: "FFE3E6EA" } };

  // Header: logo (or firm name) and title.
  let row = 1;
  if (logo) {
    const imageId = wb.addImage({ buffer: logo.data as unknown as ExcelJS.Buffer, extension: logo.format === "png" ? "png" : "jpeg" });
    ws.addImage(imageId, { tl: { col: 0, row: 0.2 }, ext: { width: 160, height: 48 }, editAs: "oneCell" });
    ws.getRow(1).height = 22;
    ws.getRow(2).height = 22;
    row = 3;
  } else {
    ws.getCell("A1").value = firmName;
    ws.getCell("A1").font = { ...font, size: 12, bold: true, color: { argb: argb(primary) } };
    row = 2;
  }
  row += 1;
  ws.getCell(`A${row}`).value = "Uitgavenoverzicht";
  ws.getCell(`A${row}`).font = { ...font, size: 20, bold: true, color: { argb: argb(primary) } };
  ws.getRow(row).height = 30;
  row += 1;
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value =
    "Vul per post het bedrag per maand in; het bedrag per jaar wordt vanzelf berekend. Uitgaven die niet maandelijks zijn (zoals vakanties of kleding)? Deel het jaarbedrag door 12.";
  ws.getCell(`A${row}`).font = { ...font, size: 10, color: { argb: "FF5B616B" } };
  ws.getCell(`A${row}`).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 30;
  row += 2;

  for (const [label, key] of [["Naam", "naam"], ["Datum", "datum"]] as const) {
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { ...font, bold: true };
    ws.mergeCells(`B${row}:D${row}`);
    const cell = ws.getCell(`B${row}`);
    cell.border = { bottom: { style: "thin", color: { argb: "FF98938A" } } };
    cell.protection = { locked: false };
    cell.name = key;
    row += 1;
  }
  row += 1;

  // Column headings
  const head = ws.getRow(row);
  head.values = ["Post", "Toelichting", "Per maand", "Per jaar"];
  head.eachCell((c, col) => {
    c.font = { ...font, bold: true, color: { argb: argb(textOn(primary)) } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(primary) } };
    c.alignment = { vertical: "middle", horizontal: col >= 3 ? "right" : "left" };
  });
  head.height = 22;
  row += 1;

  const groupTotalRows: number[] = [];
  const inputFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: argb(tint(primary, 0.92)) } };

  for (const group of EXPENSE_GROUPS) {
    const g = ws.getRow(row);
    g.getCell(1).value = group.label;
    g.getCell(1).font = { ...font, size: 12, bold: true, color: { argb: argb(primary) } };
    g.getCell(1).border = { bottom: { style: "medium", color: { argb: argb(accent) } } };
    g.height = 22;
    row += 1;
    const categoryRows: number[] = [];

    for (const cat of EXPENSE_CATEGORIES.filter((c) => c.group === group.key)) {
      const first = row + 1;
      const last = row + cat.items.length;
      const c = ws.getRow(row);
      c.getCell(1).value = cat.label;
      c.getCell(1).font = { ...font, bold: true };
      c.getCell(2).value = "subtotaal";
      c.getCell(2).font = { ...font, size: 9, italic: true, color: { argb: "FF98938A" } };
      c.getCell(3).value = { formula: `SUM(C${first}:C${last})` };
      c.getCell(4).value = { formula: `SUM(D${first}:D${last})` };
      for (const col of [3, 4]) {
        c.getCell(col).numFmt = EURO;
        c.getCell(col).font = { ...font, bold: true };
      }
      categoryRows.push(row);
      row += 1;
      for (const item of cat.items) {
        const r = ws.getRow(row);
        r.getCell(1).value = `   ${item}`;
        r.getCell(1).font = font;
        r.getCell(2).protection = { locked: false };
        r.getCell(2).font = { ...font, size: 10, color: { argb: "FF5B616B" } };
        const input = r.getCell(3);
        input.fill = inputFill;
        input.numFmt = EURO;
        input.protection = { locked: false };
        input.border = { bottom: thin };
        r.getCell(4).value = { formula: `IF(C${row}="","",C${row}*12)` };
        r.getCell(4).numFmt = EURO;
        r.getCell(4).font = { ...font, color: { argb: "FF5B616B" } };
        row += 1;
      }
    }
    const t = ws.getRow(row);
    t.getCell(1).value = `Totaal ${group.label.toLowerCase()}`;
    t.getCell(3).value = { formula: categoryRows.map((r) => `C${r}`).join("+") };
    t.getCell(4).value = { formula: categoryRows.map((r) => `D${r}`).join("+") };
    t.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { ...font, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(tint(primary, 0.85)) } };
    });
    for (const col of [3, 4]) t.getCell(col).numFmt = EURO;
    groupTotalRows.push(row);
    row += 2;
  }

  const total = ws.getRow(row);
  total.getCell(1).value = "Totale uitgaven";
  total.getCell(3).value = { formula: groupTotalRows.map((r) => `C${r}`).join("+") };
  total.getCell(4).value = { formula: groupTotalRows.map((r) => `D${r}`).join("+") };
  total.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { ...font, size: 13, bold: true, color: { argb: argb(textOn(primary)) } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(primary) } };
  });
  for (const col of [3, 4]) total.getCell(col).numFmt = EURO;
  total.height = 24;
  row += 2;
  ws.mergeCells(`A${row}:D${row}`);
  ws.getCell(`A${row}`).value = `Opgesteld door ${firmName}. Uw gegevens worden vertrouwelijk behandeld.`;
  ws.getCell(`A${row}`).font = { ...font, size: 9, italic: true, color: { argb: "FF98938A" } };

  // Only the input cells can be changed; the sums stay intact. No password: it can be switched off in Excel.
  await ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true });
  ws.headerFooter.oddFooter = `&L&8${firmName.replace(/&/g, "&&")}&R&8Pagina &P van &N`;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
