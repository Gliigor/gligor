import "server-only";

// Document extraction behind ONE function. The rest of the app only knows
// extractDocument() and the ExtractedData shape.
//
// - AI reader on (deployment configured + switched on by the firm owner):
//   Claude on Amazon Bedrock in an EU region reads the file.
// - Otherwise: a deterministic stub returns clearly labelled example data and
//   does not read the file at all.

import type { DocumentType } from "@/lib/plan/types";
import { extractWithBedrock } from "./ai/bedrock";
import type { AiReaderConfig } from "./ai/config";
import type { ExtractedData } from "./types";

export type { ExtractedData } from "./types";

export async function extractDocument(file: File, type: DocumentType, ai: AiReaderConfig | null): Promise<ExtractedData> {
  if (ai) return extractWithBedrock(ai, file, type);
  return exampleData(file, type);
}

function exampleData(file: File, type: DocumentType): ExtractedData {
  const yearMatch = file.name.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear() - 1;
  const note = "Voorbeelddata: automatisch uitlezen staat uit. Deze waarden komen niet uit het document; controleer en vervang ze.";

  if (type === "ib_aangifte") {
    return {
      documentType: type,
      year,
      method: "voorbeeld",
      prive: { geboortejaar: 1974, bruto_inkomen: 64_000 },
      partner: {},
      assets: [
        { type: "eigen_woning", label: "Hoofdverblijf", value: 785_000 },
        { type: "hypotheek", label: "Leningdeel 1", value: 310_000, metadata: { rente: 3.9, aflosvorm: "annuitair" } },
        { type: "hypotheek", label: "Leningdeel 2", value: 95_000, metadata: { rente: 4.4, aflosvorm: "aflossingsvrij" } },
        { type: "spaargeld", label: "Spaarrekening", value: 64_250 },
        { type: "beleggingen", label: "Beleggingsrekening", value: 186_800 },
      ],
      notes: [note],
      sources: [],
    };
  }

  return {
    documentType: type,
    year,
    method: "voorbeeld",
    prive: {},
    partner: {},
    assets: [
      {
        type: "bv_aandelen",
        metadata: {
          bv_naam: "Holding B.V.",
          eigen_vermogen: 1_150_000,
          liquide_middelen: 420_000,
          resultaat_na_belasting: 165_000,
          odv_waarde: 240_000,
          salaris_dga: 60_000,
          dividenduitkering: 50_000,
        },
      },
    ],
    notes: [note],
    sources: [],
  };
}
