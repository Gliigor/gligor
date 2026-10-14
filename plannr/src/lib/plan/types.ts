import {
  REPORT_SECTION_KEYS,
  SECTION_KEYS,
  isReportSectionKey,
  isStepKey,
  type ReportSectionKey,
  type SectionKey,
  type StepKey,
} from "./definitions";

// ---------------------------------------------------------------------------
// Database rows (mirrors supabase/migrations). Kept by hand for v1; can be
// replaced by `supabase gen types typescript` output later.
// ---------------------------------------------------------------------------

export type UserRole = "owner" | "planner";
export type PlanStatus = "concept" | "in_bewerking" | "afgerond";
export type ValueSource = "handmatig" | "document";
export type DocumentType = "ib_aangifte" | "jaarrekening";
export type LayoutVariant = "klassiek" | "modern" | "minimalistisch";

export interface FirmRow {
  id: string;
  name: string;
  website_url: string | null;
  created_at: string;
}

export interface UserRow {
  id: string;
  firm_id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  last_login_at: string | null;
}

export interface ClientRow {
  id: string;
  firm_id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  firm_id: string;
  client_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PlanRow {
  id: string;
  firm_id: string;
  client_id: string;
  title: string;
  status: PlanStatus;
  current_step: string;
  config: unknown;
  inputs: unknown;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRow {
  id: string;
  firm_id: string;
  plan_id: string;
  side: "prive" | "zakelijk";
  type: string;
  tax_box: number | null;
  label: string;
  value: number | null;
  metadata: AssetMetadata;
  source: ValueSource;
  sort_order: number;
}

export interface AssetMetadata {
  /** Keys ("value" or metadata keys) whose current value came from a document. */
  _fromDocument?: string[];
  [key: string]: unknown;
}

export interface DocumentRow {
  id: string;
  firm_id: string;
  plan_id: string;
  type: DocumentType;
  year: number | null;
  file_path: string;
  file_name: string;
  extraction_status: "in_behandeling" | "verwerkt" | "mislukt";
  extracted_data: unknown;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface ExportRow {
  id: string;
  firm_id: string;
  plan_id: string;
  pdf_path: string;
  sections_included: unknown;
  house_style_snapshot: unknown;
  created_by: string | null;
  created_at: string;
}

export interface HouseStyleRow {
  id: string;
  firm_id: string;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_heading: string;
  font_body: string;
  layout_variant: LayoutVariant;
  is_active: boolean;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Typed JSON columns on plans
// ---------------------------------------------------------------------------

export interface PlanConfig {
  sections: Record<SectionKey, boolean>;
  reportSections: ReportSectionKey[];
  visitedSteps: StepKey[];
  /** Insight ids the planner chose not to show in the report. */
  hiddenInsights: string[];
}

export interface PriveInputs {
  geboortejaar?: number | null;
  pensioenleeftijd?: number | null;
  bruto_inkomen?: number | null;
  jaarlijkse_uitgaven?: number | null;
  pensioen_per_jaar?: number | null;
}

export type Relatie = "gehuwd" | "samenwonend_fiscaal" | "samenwonend";

export interface PartnerInputs {
  naam?: string | null;
  relatie?: Relatie | null;
  geboortejaar?: number | null;
  pensioenleeftijd?: number | null;
  bruto_inkomen?: number | null;
  pensioen_per_jaar?: number | null;
}

export interface ChildInput {
  id: string;
  naam: string;
  geboortejaar: number | null;
}

export interface GiftPlanInput {
  id: string;
  kindId: string;
  soort: "jaarlijks" | "eenmalig_verhoogd";
  bedrag: number | null;
  startjaar: number | null;
  /** Number of years for a yearly gift. */
  jaren: number | null;
}

export interface PlanInputs {
  prive: PriveInputs;
  partner: PartnerInputs;
  kinderen: ChildInput[];
  schenkingen: GiftPlanInput[];
  /** Keys of prive inputs whose current value came from a document ("partner.x" for partner fields). */
  fromDocument: string[];
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  sections: {
    eigen_woning: true,
    inkomen: true,
    box3: true,
    pensioen: true,
    partner: false,
    kinderen: false,
    bv: false,
    balans: false,
    resultaat: false,
    pensioen_eigen_beheer: false,
    dividend: false,
  },
  reportSections: ["samenvatting", "vermogensoverzicht", "inkomsten_uitgaven", "belastingdruk", "rendementsscenarios", "schenkingen", "aandachtspunten", "toelichting"],
  visitedSteps: [],
  hiddenInsights: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads plans.config defensively: unknown keys are dropped, missing keys get defaults. */
export function parsePlanConfig(raw: unknown): PlanConfig {
  const obj = isRecord(raw) ? raw : {};
  const rawSections = isRecord(obj.sections) ? obj.sections : {};
  const sections = { ...DEFAULT_PLAN_CONFIG.sections };
  for (const key of SECTION_KEYS) {
    if (typeof rawSections[key] === "boolean") sections[key] = rawSections[key] as boolean;
  }
  const reportSections = Array.isArray(obj.reportSections)
    ? REPORT_SECTION_KEYS.filter((k) => (obj.reportSections as unknown[]).includes(k))
    : [...DEFAULT_PLAN_CONFIG.reportSections];
  const visitedSteps = Array.isArray(obj.visitedSteps)
    ? (obj.visitedSteps as unknown[]).filter((s): s is StepKey => typeof s === "string" && isStepKey(s))
    : [];
  const hiddenInsights = Array.isArray(obj.hiddenInsights)
    ? (obj.hiddenInsights as unknown[]).filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,64}$/.test(s))
    : [];
  return { sections, reportSections, visitedSteps, hiddenInsights };
}

const NUMERIC_PRIVE_KEYS = ["geboortejaar", "pensioenleeftijd", "bruto_inkomen", "jaarlijkse_uitgaven", "pensioen_per_jaar"] as const;
const NUMERIC_PARTNER_KEYS = ["geboortejaar", "pensioenleeftijd", "bruto_inkomen", "pensioen_per_jaar"] as const;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const id = (v: unknown) => (typeof v === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(v) ? v : null);

export function parsePlanInputs(raw: unknown): PlanInputs {
  const obj = isRecord(raw) ? raw : {};
  const rawPrive = isRecord(obj.prive) ? obj.prive : {};
  const prive: PriveInputs = {};
  for (const key of NUMERIC_PRIVE_KEYS) prive[key] = num(rawPrive[key]);

  const rawPartner = isRecord(obj.partner) ? obj.partner : {};
  const partner: PartnerInputs = {};
  for (const key of NUMERIC_PARTNER_KEYS) partner[key] = num(rawPartner[key]);
  partner.naam = str(rawPartner.naam, 100) || null;
  const rel = rawPartner.relatie;
  partner.relatie = rel === "gehuwd" || rel === "samenwonend_fiscaal" || rel === "samenwonend" ? rel : null;

  const kinderen: ChildInput[] = (Array.isArray(obj.kinderen) ? obj.kinderen : [])
    .filter(isRecord)
    .map((k) => ({ id: id(k.id) ?? "", naam: str(k.naam, 100), geboortejaar: num(k.geboortejaar) }))
    .filter((k) => k.id)
    .slice(0, 20);
  const childIds = new Set(kinderen.map((k) => k.id));
  const schenkingen: GiftPlanInput[] = (Array.isArray(obj.schenkingen) ? obj.schenkingen : [])
    .filter(isRecord)
    .map((g) => ({
      id: id(g.id) ?? "",
      kindId: id(g.kindId) ?? "",
      soort: (g.soort === "eenmalig_verhoogd" ? "eenmalig_verhoogd" : "jaarlijks") as GiftPlanInput["soort"],
      bedrag: num(g.bedrag),
      startjaar: num(g.startjaar),
      jaren: num(g.jaren),
    }))
    .filter((g) => g.id && childIds.has(g.kindId))
    .slice(0, 60);

  const fromDocument = Array.isArray(obj.fromDocument)
    ? (obj.fromDocument as unknown[]).filter((k): k is string => typeof k === "string")
    : [];
  return { prive, partner, kinderen, schenkingen, fromDocument };
}

export function parseReportSections(raw: unknown): ReportSectionKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is ReportSectionKey => typeof s === "string" && isReportSectionKey(s));
}

/** Postgres numeric comes back as string or number depending on driver settings. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeAsset(row: Record<string, unknown>): AssetRow {
  return {
    ...(row as unknown as AssetRow),
    value: toNumber(row.value),
    metadata: isRecord(row.metadata) ? (row.metadata as AssetMetadata) : {},
  };
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  concept: "Concept",
  in_bewerking: "In bewerking",
  afgerond: "Afgerond",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ib_aangifte: "IB-aangifte",
  jaarrekening: "Jaarrekening",
};
