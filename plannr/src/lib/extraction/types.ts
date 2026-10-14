import type { DocumentType } from "@/lib/plan/types";

/** How a document was read: example data (no reader configured) or the AI reader. */
export type ExtractionMethod = "voorbeeld" | "ai";

/** One value found in a document, for the planner to check against the source. */
export interface ExtractionSource {
  label: string;
  value: string;
  /** 1-based page in the uploaded file, when the reader could tell. */
  page: number | null;
}

/** Structured output of document extraction, independent of how it was produced. */
export interface ExtractedData {
  documentType: DocumentType;
  year: number | null;
  method: ExtractionMethod;
  /** Non-asset privé inputs (plans.inputs.prive keys). */
  prive: Partial<Record<"geboortejaar" | "bruto_inkomen", number>>;
  /** Partner inputs (plans.inputs.partner keys). */
  partner: Partial<Record<"naam" | "relatie", string> & Record<"geboortejaar" | "bruto_inkomen", number>>;
  /** Asset rows found in the document (asset registry types + metadata keys, incl. "eigenaar"). */
  assets: { type: string; label?: string; value?: number; metadata?: Record<string, number | string> }[];
  /** Human-readable notes for the planner (Dutch). */
  notes: string[];
  /** Every value found, with its page, shown next to the document. */
  sources: ExtractionSource[];
}
