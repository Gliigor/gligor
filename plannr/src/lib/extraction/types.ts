import type { DocumentType } from "@/lib/plan/types";

/** Structured output of document extraction, independent of how it was produced. */
export interface ExtractedData {
  documentType: DocumentType;
  year: number | null;
  /** Non-asset privé inputs (plans.inputs.prive keys). */
  prive: Partial<Record<"geboortejaar" | "bruto_inkomen", number>>;
  /** Asset rows found in the document (asset registry types + metadata keys). */
  assets: { type: string; label?: string; value?: number; metadata?: Record<string, number | string> }[];
  /** Human-readable notes for the planner (e.g. "stub: voorbeelddata"). */
  notes: string[];
}
