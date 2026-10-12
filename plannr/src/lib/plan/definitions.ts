// Static definitions that drive the planning flow: plan sections (step 1),
// the steps themselves, report sections (step 6), and the field/asset
// registries that the privé and zakelijk control steps render.
//
// Adding a new asset type (e.g. foreign real estate with a country field) means
// adding one entry to ASSET_TYPES — no database change is needed, because
// type-specific fields are stored in assets.metadata.

export type Side = "prive" | "zakelijk";

export const SECTION_KEYS = [
  "eigen_woning",
  "inkomen",
  "box3",
  "pensioen",
  "bv",
  "balans",
  "resultaat",
  "pensioen_eigen_beheer",
  "dividend",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface SectionDef {
  key: SectionKey;
  side: Side;
  label: string;
  description: string;
}

export const SECTIONS: SectionDef[] = [
  { key: "eigen_woning", side: "prive", label: "Eigen woning & hypotheek", description: "Box 1: WOZ-waarde, hypotheek en renteaftrek" },
  { key: "inkomen", side: "prive", label: "Inkomen & uitgaven", description: "Inkomen uit arbeid en uitgaven van het huishouden" },
  { key: "box3", side: "prive", label: "Vermogen box 3", description: "Spaargeld, beleggingen, overig onroerend goed en schulden" },
  { key: "pensioen", side: "prive", label: "Pensioen & AOW", description: "Opgebouwd pensioen en AOW-situatie" },
  { key: "bv", side: "zakelijk", label: "BV / aanmerkelijk belang", description: "Box 2: BV, aandelenbezit en DGA-salaris" },
  { key: "balans", side: "zakelijk", label: "Balans BV", description: "Eigen vermogen en liquide middelen" },
  { key: "resultaat", side: "zakelijk", label: "Resultaat BV", description: "Resultaat na belasting" },
  { key: "pensioen_eigen_beheer", side: "zakelijk", label: "Pensioen in eigen beheer / ODV", description: "Waarde van de pensioen- of oudedagsverplichting" },
  { key: "dividend", side: "zakelijk", label: "Dividend", description: "Jaarlijkse dividenduitkering" },
];

export const STEP_KEYS = ["configuratie", "documenten", "prive", "zakelijk", "resultaten", "rapport"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "configuratie", label: "Configuratie", short: "Config" },
  { key: "documenten", label: "Documenten", short: "Docs" },
  { key: "prive", label: "Privé", short: "Privé" },
  { key: "zakelijk", label: "Zakelijk", short: "Zakelijk" },
  { key: "resultaten", label: "Resultaten", short: "Result." },
  { key: "rapport", label: "Rapport & export", short: "Rapport" },
];

export function isStepKey(value: string): value is StepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

export const REPORT_SECTION_KEYS = [
  "samenvatting",
  "vermogensoverzicht",
  "inkomsten_uitgaven",
  "belastingdruk",
  "rendementsscenarios",
  "zakelijk_overzicht",
  "toelichting",
] as const;
export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export const REPORT_SECTIONS: { key: ReportSectionKey; label: string; description: string }[] = [
  { key: "samenvatting", label: "Samenvatting", description: "Kerncijfers op één pagina" },
  { key: "vermogensoverzicht", label: "Vermogensoverzicht", description: "Bezittingen en schulden, privé en zakelijk" },
  { key: "inkomsten_uitgaven", label: "Inkomsten vs. uitgaven", description: "Netto inkomen, uitgaven en jaarlijks saldo" },
  { key: "belastingdruk", label: "Belastingdruk per box", description: "Indicatie box 1, 2 en 3" },
  { key: "rendementsscenarios", label: "Rendementsscenario's", description: "Verwachte vermogensontwikkeling in drie scenario's" },
  { key: "zakelijk_overzicht", label: "Zakelijk overzicht", description: "BV, balans, resultaat en dividend" },
  { key: "toelichting", label: "Toelichting & uitgangspunten", description: "Aannames en disclaimer" },
];

export function isReportSectionKey(value: string): value is ReportSectionKey {
  return (REPORT_SECTION_KEYS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export type FieldKind = "money" | "percent" | "integer" | "text" | "select";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  /** The plan section that must be enabled for this field to show. */
  section: SectionKey | "algemeen";
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
}

/** Non-asset privé inputs, stored in plans.inputs.prive. */
export const PRIVE_INPUT_FIELDS: FieldDef[] = [
  { key: "geboortejaar", label: "Geboortejaar", kind: "integer", section: "algemeen", required: true },
  {
    key: "pensioenleeftijd",
    label: "Gewenste pensioenleeftijd",
    kind: "integer",
    section: "algemeen",
    required: true,
    help: "Leeftijd waarop de cliënt wil stoppen met werken.",
  },
  {
    key: "bruto_inkomen",
    label: "Bruto inkomen uit arbeid (per jaar)",
    kind: "money",
    section: "inkomen",
    required: true,
    help: "Exclusief DGA-salaris; dat vult u in bij Zakelijk.",
  },
  {
    key: "jaarlijkse_uitgaven",
    label: "Netto uitgaven huishouden (per jaar)",
    kind: "money",
    section: "inkomen",
    required: true,
  },
  {
    key: "pensioen_per_jaar",
    label: "Opgebouwd pensioen (bruto per jaar)",
    kind: "money",
    section: "pensioen",
    required: true,
    help: "Verwachte uitkering vanaf pensioenleeftijd, exclusief AOW.",
  },
  {
    key: "aow_situatie",
    label: "AOW-situatie",
    kind: "select",
    section: "pensioen",
    required: true,
    options: [
      { value: "alleenstaand", label: "Alleenstaand" },
      { value: "samenwonend", label: "Samenwonend / gehuwd" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Asset types
// ---------------------------------------------------------------------------

export interface AssetTypeDef {
  type: string;
  side: Side;
  taxBox: 1 | 2 | 3;
  kind: "bezitting" | "schuld";
  /** The row is relevant when any of these sections is enabled. */
  sections: SectionKey[];
  label: string;
  /** Label for a single row, e.g. "Leningdeel". */
  itemLabel: string;
  multiple: boolean;
  /** When relevant, at least one row is expected (otherwise it counts as missing). */
  requiredRow: boolean;
  /** Where the row's main value is entered. Omitted when the value is derived. */
  valueField?: { label: string; required: boolean; help?: string };
  /** Whether the free-text "omschrijving" (assets.label) is shown. */
  showLabel: boolean;
  /** Type-specific fields stored in assets.metadata. */
  metadataFields: FieldDef[];
}

export const ASSET_TYPES: AssetTypeDef[] = [
  {
    type: "eigen_woning",
    side: "prive",
    taxBox: 1,
    kind: "bezitting",
    sections: ["eigen_woning"],
    label: "Eigen woning",
    itemLabel: "Woning",
    multiple: false,
    requiredRow: true,
    valueField: { label: "WOZ-waarde", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    type: "hypotheek",
    side: "prive",
    taxBox: 1,
    kind: "schuld",
    sections: ["eigen_woning"],
    label: "Hypotheek",
    itemLabel: "Leningdeel",
    multiple: true,
    requiredRow: false,
    valueField: { label: "Openstaande schuld", required: true },
    showLabel: true,
    metadataFields: [
      { key: "rente", label: "Rente", kind: "percent", section: "eigen_woning", required: true },
      {
        key: "aflosvorm",
        label: "Aflosvorm",
        kind: "select",
        section: "eigen_woning",
        options: [
          { value: "annuitair", label: "Annuïtair" },
          { value: "lineair", label: "Lineair" },
          { value: "aflossingsvrij", label: "Aflossingsvrij" },
        ],
      },
    ],
  },
  {
    type: "spaargeld",
    side: "prive",
    taxBox: 3,
    kind: "bezitting",
    sections: ["box3"],
    label: "Spaargeld",
    itemLabel: "Rekening",
    multiple: true,
    requiredRow: true,
    valueField: { label: "Saldo", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    type: "beleggingen",
    side: "prive",
    taxBox: 3,
    kind: "bezitting",
    sections: ["box3"],
    label: "Beleggingen",
    itemLabel: "Portefeuille",
    multiple: true,
    requiredRow: false,
    valueField: { label: "Waarde", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    type: "overig_vastgoed_nl",
    side: "prive",
    taxBox: 3,
    kind: "bezitting",
    sections: ["box3"],
    label: "Overig onroerend goed (Nederland)",
    itemLabel: "Object",
    multiple: true,
    requiredRow: false,
    valueField: { label: "WOZ-waarde", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    type: "schulden_box3",
    side: "prive",
    taxBox: 3,
    kind: "schuld",
    sections: ["box3"],
    label: "Schulden (box 3)",
    itemLabel: "Schuld",
    multiple: true,
    requiredRow: false,
    valueField: { label: "Openstaand bedrag", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    // One row per BV. v1 shows exactly one; holding structures can add more
    // rows of this type later.
    type: "bv_aandelen",
    side: "zakelijk",
    taxBox: 2,
    kind: "bezitting",
    sections: ["bv", "balans", "resultaat", "pensioen_eigen_beheer", "dividend"],
    label: "BV",
    itemLabel: "BV",
    multiple: false,
    requiredRow: true,
    showLabel: false,
    metadataFields: [
      { key: "bv_naam", label: "Naam BV", kind: "text", section: "bv", required: true },
      {
        key: "aandelen_percentage",
        label: "Aandelenbezit (aanmerkelijk belang)",
        kind: "percent",
        section: "bv",
        required: true,
        help: "Vanaf 5% is sprake van een aanmerkelijk belang (box 2).",
      },
      { key: "salaris_dga", label: "Salaris DGA (bruto per jaar)", kind: "money", section: "bv", required: true },
      { key: "eigen_vermogen", label: "Eigen vermogen BV", kind: "money", section: "balans", required: true },
      { key: "liquide_middelen", label: "Liquide middelen BV", kind: "money", section: "balans", required: true },
      { key: "resultaat_na_belasting", label: "Resultaat na belasting", kind: "money", section: "resultaat", required: true },
      {
        key: "odv_waarde",
        label: "Pensioen in eigen beheer / ODV (waarde)",
        kind: "money",
        section: "pensioen_eigen_beheer",
        required: true,
      },
      { key: "dividenduitkering", label: "Dividenduitkering (per jaar)", kind: "money", section: "dividend", required: true },
    ],
  },
];

export function getAssetType(type: string): AssetTypeDef | undefined {
  return ASSET_TYPES.find((t) => t.type === type);
}
