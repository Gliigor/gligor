// Document extraction behind ONE function. The rest of the app only knows
// extractDocument() and the ExtractedData shape — swapping this stub for real
// extraction (OCR, an AI model, or a specialist API) changes nothing else.
//
// v1: a deterministic stub that returns realistic example data. It does not
// read the file contents at all, so no financial data is processed or logged.

import type { DocumentType } from "@/lib/plan/types";
import type { ExtractedData } from "./types";

export type { ExtractedData } from "./types";

export async function extractDocument(file: File, type: DocumentType): Promise<ExtractedData> {
  const yearMatch = file.name.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear() - 1;
  const note = "Voorbeelddata: automatische uitlezing is in dit prototype nog niet actief. Controleer alle waarden.";

  if (type === "ib_aangifte") {
    return {
      documentType: type,
      year,
      prive: { geboortejaar: 1974, bruto_inkomen: 64_000 },
      assets: [
        { type: "eigen_woning", label: "Hoofdverblijf", value: 785_000 },
        { type: "hypotheek", label: "Leningdeel 1", value: 310_000, metadata: { rente: 3.9, aflosvorm: "annuitair" } },
        { type: "hypotheek", label: "Leningdeel 2", value: 95_000, metadata: { rente: 4.4, aflosvorm: "aflossingsvrij" } },
        { type: "spaargeld", label: "Spaarrekening", value: 64_250 },
        { type: "beleggingen", label: "Beleggingsrekening", value: 186_800 },
      ],
      notes: [note],
    };
  }

  return {
    documentType: type,
    year,
    prive: {},
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
  };
}
