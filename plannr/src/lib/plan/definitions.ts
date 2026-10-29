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
  "partner",
  "kinderen",
  "bv",
  "balans",
  "resultaat",
  "pensioen_eigen_beheer",
  "dividend",
  "eenmanszaak",
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
  { key: "pensioen", side: "prive", label: "Pensioen & AOW", description: "Opgebouwd pensioen; AOW wordt automatisch meegenomen" },
  { key: "partner", side: "prive", label: "Partner", description: "Inkomen, pensioen en fiscaal partnerschap; eigendom per bezitting" },
  { key: "kinderen", side: "prive", label: "Kinderen & schenkingen", description: "Kinderen en geplande schenkingen met vrijstellingen" },
  { key: "bv", side: "zakelijk", label: "BV / aanmerkelijk belang", description: "Box 2: BV, aandelenbezit en DGA-salaris" },
  { key: "balans", side: "zakelijk", label: "Balans BV", description: "Eigen vermogen en liquide middelen" },
  { key: "resultaat", side: "zakelijk", label: "Resultaat BV", description: "Resultaat na belasting" },
  { key: "pensioen_eigen_beheer", side: "zakelijk", label: "Pensioen in eigen beheer / ODV", description: "Waarde van de pensioen- of oudedagsverplichting" },
  { key: "dividend", side: "zakelijk", label: "Dividend", description: "Jaarlijkse dividenduitkering" },
  {
    key: "eenmanszaak",
    side: "zakelijk",
    label: "Eenmanszaak / IB-ondernemer",
    description: "Winst uit onderneming in box 1, met ondernemersaftrek en MKB-winstvrijstelling",
  },
];

export const STEP_KEYS = ["documenten", "gezin", "woning", "inkomen", "uitgaven", "vermogen", "zakelijk", "uitgangspunten", "resultaten", "rapport"] as const;
export type StepKey = (typeof STEP_KEYS)[number];

export const STEPS: { key: StepKey; label: string; short: string }[] = [
  { key: "documenten", label: "Documenten", short: "Docs" },
  { key: "gezin", label: "Gezin", short: "Gezin" },
  { key: "woning", label: "Woning", short: "Woning" },
  { key: "inkomen", label: "Inkomen", short: "Inkomen" },
  { key: "uitgaven", label: "Uitgaven", short: "Uitgaven" },
  { key: "vermogen", label: "Vermogen", short: "Vermogen" },
  { key: "zakelijk", label: "Zakelijk", short: "Zakelijk" },
  { key: "uitgangspunten", label: "Uitgangspunten", short: "Aannames" },
  { key: "resultaten", label: "Resultaten", short: "Result." },
  { key: "rapport", label: "Rapport", short: "Rapport" },
];

/** Older step URLs (before the step-by-step privé flow) and where they lead now. */
export const LEGACY_STEPS: Record<string, StepKey> = { configuratie: "documenten", prive: "gezin" };

/** The privé steps that each show part of the privé data. */
export type PrivePart = "gezin" | "woning" | "inkomen" | "uitgaven" | "vermogen";
export const PRIVE_PARTS: PrivePart[] = ["gezin", "woning", "inkomen", "uitgaven", "vermogen"];

/** Which step a privé input field is filled in. */
export const PRIVE_FIELD_STEP: Record<string, PrivePart> = {
  geboortejaar: "gezin",
  pensioenleeftijd: "gezin",
  functie: "gezin",
  bruto_inkomen: "inkomen",
  pensioen_per_jaar: "inkomen",
  jaarlijkse_uitgaven: "uitgaven",
};

/** Partner fields filled in at Inkomen; the rest belong to Gezin. */
export const PARTNER_INCOME_FIELDS = ["bruto_inkomen", "pensioen_per_jaar"];

/** Which step a privé asset type is filled in (everything else: vermogen). */
const ASSET_TYPE_STEP: Record<string, PrivePart> = {
  eigen_woning: "woning",
  hypotheek: "woning",
  spaarrekening_eigen_woning: "woning",
  lijfrente: "inkomen",
};

export function stepOfAssetType(def: { type: string; side: Side }): StepKey {
  if (def.side === "zakelijk") return "zakelijk";
  return ASSET_TYPE_STEP[def.type] ?? "vermogen";
}

export function isStepKey(value: string): value is StepKey {
  return (STEP_KEYS as readonly string[]).includes(value);
}

export const REPORT_SECTION_KEYS = [
  "samenvatting",
  "vermogensoverzicht",
  "inkomsten_uitgaven",
  "belastingdruk",
  "rendementsscenarios",
  "tijdlijn",
  "zakelijk_overzicht",
  "schenkingen",
  "scenarios",
  "aandachtspunten",
  "toelichting",
] as const;
export type ReportSectionKey = (typeof REPORT_SECTION_KEYS)[number];

export const REPORT_SECTIONS: { key: ReportSectionKey; label: string; description: string }[] = [
  { key: "samenvatting", label: "Samenvatting", description: "Kerncijfers op één pagina" },
  { key: "vermogensoverzicht", label: "Vermogensoverzicht", description: "Bezittingen en schulden, privé en zakelijk" },
  { key: "inkomsten_uitgaven", label: "Inkomsten vs. uitgaven", description: "Netto inkomen, uitgaven en jaarlijks saldo" },
  { key: "belastingdruk", label: "Belastingdruk per box", description: "Indicatie box 1, 2 en 3" },
  { key: "rendementsscenarios", label: "Rendementsscenario's", description: "Verwachte vermogensontwikkeling in drie scenario's" },
  { key: "tijdlijn", label: "Tijdlijn", description: "Belangrijke momenten: pensioen, AOW, rentevaste periodes en uitkeringen" },
  { key: "zakelijk_overzicht", label: "Zakelijk overzicht", description: "BV, balans, resultaat en dividend" },
  { key: "schenkingen", label: "Gezin & schenkingen", description: "Partner, kinderen en geplande schenkingen" },
  { key: "scenarios", label: "Scenariovergelijking", description: "Dit plan naast de scenario's die ervan zijn gemaakt" },
  { key: "aandachtspunten", label: "Aandachtspunten", description: "Kansen en risico's om te bespreken" },
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
  /** BV only: shown when the full balance sheet and P&L are switched on for that BV. */
  extended?: boolean;
  /** Calculated by Plannr from other fields; shown read-only. */
  derived?: boolean;
}

/** Non-asset privé inputs, stored in plans.inputs.prive. */
export const PRIVE_INPUT_FIELDS: FieldDef[] = [
  { key: "geboortejaar", label: "Geboortejaar", kind: "integer", section: "algemeen", required: true },
  { key: "functie", label: "Functie / beroep", kind: "text", section: "algemeen", help: "Optioneel, voor het rapport." },
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
    label: "Totale uitgaven huishouden (per jaar)",
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
];

/** Partner fields, stored in plans.inputs.partner. */
export const PARTNER_FIELDS: FieldDef[] = [
  { key: "naam", label: "Voornaam partner", kind: "text", section: "partner", required: true },
  {
    key: "relatie",
    label: "Relatie",
    kind: "select",
    section: "partner",
    required: true,
    help: "Gehuwden, geregistreerd partners en samenwoners met een notarieel samenlevingscontract zijn fiscaal partner.",
    options: [
      { value: "gehuwd", label: "Gehuwd / geregistreerd partner" },
      { value: "samenwonend_fiscaal", label: "Samenwonend, fiscaal partner" },
      { value: "samenwonend", label: "Samenwonend, geen fiscaal partner" },
    ],
  },
  { key: "geboortejaar", label: "Geboortejaar", kind: "integer", section: "partner", required: true },
  { key: "functie", label: "Functie / beroep", kind: "text", section: "partner", help: "Optioneel, voor het rapport." },
  { key: "pensioenleeftijd", label: "Gewenste pensioenleeftijd", kind: "integer", section: "partner", required: true },
  {
    key: "bruto_inkomen",
    label: "Bruto inkomen uit arbeid (per jaar)",
    kind: "money",
    section: "partner",
    required: true,
    help: "Exclusief salaris uit een eigen BV; dat vult u in bij Zakelijk.",
  },
  {
    key: "pensioen_per_jaar",
    label: "Opgebouwd pensioen (bruto per jaar)",
    kind: "money",
    section: "partner",
    help: "Exclusief AOW.",
  },
];

export const OWNER_OPTIONS = [
  { value: "joint", label: "Samen" },
  { value: "client", label: "Cliënt" },
  { value: "partner", label: "Partner" },
] as const;
export type OwnerValue = (typeof OWNER_OPTIONS)[number]["value"];

export const GIFT_KINDS = [
  { value: "jaarlijks", label: "Jaarlijkse schenking" },
  { value: "eenmalig_verhoogd", label: "Eenmalig verhoogde vrijstelling (18–40 jaar)" },
] as const;

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
  /** Not shown by default: added through "Onderwerp toevoegen" when the client has it. */
  optional?: boolean;
  /** One line shown in the "Onderwerp toevoegen" list. */
  description?: string;
  /** Metadata a new row starts with. */
  defaults?: Record<string, string | number>;
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
    valueField: { label: "WOZ-waarde", required: true, help: "Voor de belasting (eigenwoningforfait)." },
    showLabel: true,
    metadataFields: [
      {
        key: "vrije_verkoopwaarde",
        label: "Geschatte vrije verkoopwaarde",
        kind: "money",
        section: "eigen_woning",
        help: "Wat de woning nu opbrengt bij verkoop. Leeg: de WOZ-waarde. Telt mee in het vermogen.",
      },
    ],
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
        key: "rentevast_tot",
        label: "Rentevast tot (jaar)",
        kind: "integer",
        section: "eigen_woning",
        help: "Het jaar waarin de rentevaste periode afloopt. Komt op de tijdlijn in het rapport.",
      },
      { key: "ingangsjaar", label: "Afgesloten in (jaar)", kind: "integer", section: "eigen_woning", help: "Na 30 jaar eindigt de renteaftrek." },
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
    valueField: { label: "WOZ-waarde", required: true, help: "Voor de belasting (eigenwoningforfait)." },
    showLabel: true,
    metadataFields: [
      {
        key: "vrije_verkoopwaarde",
        label: "Geschatte vrije verkoopwaarde",
        kind: "money",
        section: "eigen_woning",
        help: "Wat de woning nu opbrengt bij verkoop. Leeg: de WOZ-waarde. Telt mee in het vermogen.",
      },
    ],
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
    // An IB-ondernemer: profit is box 1 income of the owner; the business equity is box 1 wealth.
    type: "eenmanszaak",
    side: "zakelijk",
    taxBox: 1,
    kind: "bezitting",
    sections: ["eenmanszaak"],
    label: "Eenmanszaak",
    itemLabel: "Onderneming",
    multiple: true,
    requiredRow: true,
    valueField: { label: "Ondernemingsvermogen", required: true, help: "Eigen vermogen volgens de balans van de onderneming." },
    showLabel: false,
    defaults: { urencriterium: "ja", starter: "nee" },
    metadataFields: [
      { key: "naam", label: "Naam onderneming", kind: "text", section: "eenmanszaak", required: true },
      { key: "winst", label: "Verwachte winst per jaar (vóór ondernemersaftrek)", kind: "money", section: "eenmanszaak", required: true },
      {
        key: "urencriterium",
        label: "Voldoet aan het urencriterium (1.225 uur)",
        kind: "select",
        section: "eenmanszaak",
        required: true,
        help: "Dan geldt de zelfstandigenaftrek.",
        options: [
          { value: "ja", label: "Ja" },
          { value: "nee", label: "Nee" },
        ],
      },
      {
        key: "starter",
        label: "Startende ondernemer",
        kind: "select",
        section: "eenmanszaak",
        help: "Startersaftrek in de eerste drie jaar (met urencriterium).",
        options: [
          { value: "nee", label: "Nee" },
          { value: "ja", label: "Ja" },
        ],
      },
      {
        key: "eindjaar",
        label: "Stopt in jaar",
        kind: "integer",
        section: "eenmanszaak",
        help: "Leeg laten: tot de pensioenleeftijd van de eigenaar.",
      },
    ],
  },

  // --- Optional privé topics (added when the client has them) ---------------------
  {
    type: "kapitaalverzekering",
    side: "prive",
    taxBox: 1,
    kind: "bezitting",
    sections: ["box3", "pensioen"],
    label: "Kapitaalverzekering",
    itemLabel: "Polis",
    multiple: true,
    requiredRow: false,
    optional: true,
    defaults: { fiscaal: "vrijgesteld" },
    description: "Kapitaalverzekering eigen woning (KEW) of spaarverzekering",
    valueField: { label: "Huidige waarde", required: true },
    showLabel: true,
    metadataFields: [
      { key: "uitkering_jaar", label: "Jaar van uitkering", kind: "integer", section: "algemeen", required: true },
      {
        key: "verwachte_uitkering",
        label: "Verwachte uitkering",
        kind: "money",
        section: "algemeen",
        help: "Leeg laten om te rekenen met de huidige waarde plus rendement.",
      },
      {
        key: "fiscaal",
        label: "Fiscale behandeling",
        kind: "select",
        section: "algemeen",
        required: true,
        options: [
          { value: "vrijgesteld", label: "Vrijgesteld (box 1)" },
          { value: "box3", label: "Box 3" },
        ],
      },
    ],
  },
  {
    type: "lijfrente",
    side: "prive",
    taxBox: 1,
    kind: "bezitting",
    sections: ["pensioen", "box3"],
    label: "Lijfrente",
    itemLabel: "Lijfrente",
    multiple: true,
    requiredRow: false,
    optional: true,
    defaults: { duur_jaren: 20 },
    description: "Lijfrenteverzekering, bancaire lijfrente of stamrecht",
    valueField: { label: "Opgebouwde waarde", required: true },
    showLabel: true,
    metadataFields: [
      { key: "start_uitkering", label: "Uitkering vanaf jaar", kind: "integer", section: "algemeen", required: true },
      { key: "duur_jaren", label: "Looptijd uitkering (jaren)", kind: "integer", section: "algemeen", required: true },
      {
        key: "jaarlijkse_inleg",
        label: "Jaarlijkse inleg tot uitkering",
        kind: "money",
        section: "algemeen",
        help: "Aftrekbaar in box 1 binnen de jaarruimte.",
      },
    ],
  },
  {
    type: "spaarrekening_eigen_woning",
    side: "prive",
    taxBox: 1,
    kind: "bezitting",
    sections: ["eigen_woning"],
    label: "Spaarrekening eigen woning",
    itemLabel: "Rekening",
    multiple: true,
    requiredRow: false,
    optional: true,
    description: "Spaarrekening of beleggingsrecht eigen woning (vrijgesteld)",
    valueField: { label: "Saldo", required: true },
    showLabel: true,
    metadataFields: [],
  },
  {
    type: "lening_dga",
    side: "prive",
    taxBox: 3,
    kind: "schuld",
    sections: ["bv"],
    label: "Lening van de eigen BV",
    itemLabel: "Lening",
    multiple: true,
    requiredRow: false,
    optional: true,
    defaults: { eigen_woning: "nee" },
    description: "Schuld van de DGA aan de eigen BV (rekening-courant of lening)",
    valueField: { label: "Openstaande schuld", required: true },
    showLabel: true,
    metadataFields: [
      { key: "rente", label: "Rente", kind: "percent", section: "algemeen", required: true },
      {
        key: "eigen_woning",
        label: "Gebruikt voor",
        kind: "select",
        section: "algemeen",
        required: true,
        help: "Een lening voor de eigen woning telt niet mee voor de grens van excessief lenen.",
        options: [
          { value: "nee", label: "Overig (box 3)" },
          { value: "ja", label: "Eigen woning (box 1)" },
        ],
      },
    ],
  },
  {
    type: "vordering_bv",
    side: "prive",
    taxBox: 1,
    kind: "bezitting",
    sections: ["bv"],
    label: "Lening aan de eigen BV",
    itemLabel: "Lening",
    multiple: true,
    requiredRow: false,
    optional: true,
    description: "Geld dat de DGA aan de eigen BV heeft geleend (terbeschikkingstelling, box 1)",
    valueField: { label: "Uitstaand bedrag", required: true },
    showLabel: true,
    metadataFields: [{ key: "rente", label: "Rente", kind: "percent", section: "algemeen", required: true }],
  },
  {
    type: "vordering_derden",
    side: "prive",
    taxBox: 3,
    kind: "bezitting",
    sections: ["box3"],
    label: "Lening aan derden",
    itemLabel: "Vordering",
    multiple: true,
    requiredRow: false,
    optional: true,
    description: "Uitgeleend geld aan anderen, bijvoorbeeld familie (box 3)",
    valueField: { label: "Uitstaand bedrag", required: true },
    showLabel: true,
    metadataFields: [{ key: "rente", label: "Rente", kind: "percent", section: "algemeen" }],
  },
  {
    // One row per BV; a holding with a werkmaatschappij is two rows.
    type: "bv_aandelen",
    side: "zakelijk",
    taxBox: 2,
    kind: "bezitting",
    sections: ["bv", "balans", "resultaat", "pensioen_eigen_beheer", "dividend"],
    label: "BV",
    itemLabel: "BV",
    multiple: true,
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
      {
        key: "gehouden_door",
        label: "Aandelen gehouden",
        kind: "select",
        section: "bv",
        help: "Een werkmaatschappij onder een holding valt niet zelf in box 2: de waarde zit in de deelneming van de holding.",
        options: [
          { value: "dga", label: "Rechtstreeks (box 2)" },
          { value: "holding", label: "Via een andere BV (holding)" },
        ],
      },
      { key: "salaris_dga", label: "Salaris DGA (bruto per jaar)", kind: "money", section: "bv", required: true },
      // Full balance sheet (optional, per BV)
      { key: "vaste_activa", label: "Vaste activa (geen deelnemingen)", kind: "money", section: "balans", extended: true },
      { key: "deelnemingen", label: "Deelnemingen", kind: "money", section: "balans", extended: true },
      { key: "vordering_dga", label: "Vordering op DGA (rekening-courant)", kind: "money", section: "balans", extended: true },
      { key: "overige_vorderingen", label: "Uitgeleend geld en overige vorderingen", kind: "money", section: "balans", extended: true },
      { key: "liquide_middelen", label: "Liquide middelen BV", kind: "money", section: "balans", required: true },
      { key: "aandelenkapitaal", label: "Aandelenkapitaal", kind: "money", section: "balans", extended: true },
      {
        key: "agio",
        label: "Agio (fiscaal gestort kapitaal)",
        kind: "money",
        section: "balans",
        extended: true,
        help: "Kan zonder box 2-heffing worden terugbetaald.",
      },
      { key: "schuld_dga", label: "Schuld aan DGA", kind: "money", section: "balans", extended: true },
      { key: "bankleningen", label: "Bankleningen", kind: "money", section: "balans", extended: true },
      { key: "overige_schulden", label: "Overige schulden", kind: "money", section: "balans", extended: true },
      { key: "eigen_vermogen", label: "Eigen vermogen BV", kind: "money", section: "balans", required: true },
      // Profit and loss (optional, per BV)
      { key: "opbrengsten", label: "Opbrengsten / omzet", kind: "money", section: "resultaat", extended: true },
      { key: "management_fee", label: "Managementvergoeding ontvangen", kind: "money", section: "resultaat", extended: true },
      { key: "bedrijfskosten", label: "Bedrijfskosten (excl. DGA-salaris)", kind: "money", section: "resultaat", extended: true },
      { key: "afschrijvingen", label: "Afschrijvingen", kind: "money", section: "resultaat", extended: true },
      { key: "verlies_te_verrekenen", label: "Te verrekenen verlies", kind: "money", section: "resultaat", extended: true },
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

// ---------------------------------------------------------------------------
// Income and expenses over time (plans.inputs.posten)
// ---------------------------------------------------------------------------

export type CashGroup = "inkomen" | "uitgave";
/** box1: taxed in box 1 of the person; onbelast: received tax-free; aftrekbaar: deductible expense. */
export type CashTax = "box1" | "onbelast" | "aftrekbaar" | "geen";

export interface CashKindDef {
  kind: string;
  group: CashGroup;
  label: string;
  tax: CashTax;
  /** Belongs to one person (needed for box 1). Household items have no person. */
  perPerson: boolean;
  /** Happens in one year only. */
  oneOff: boolean;
  /** When no start year is entered: from now, or from the person's retirement year. */
  defaultStart: "nu" | "pensioen";
  /** The plan section that must be enabled for this kind to be offered. */
  section: SectionKey;
  help?: string;
}

export const CASH_KINDS: CashKindDef[] = [
  { kind: "salaris", group: "inkomen", label: "Salaris (geen DGA)", tax: "box1", perPerson: true, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Een extra dienstbetrekking, of een baan die later begint of eindigt." },
  { kind: "uitkering", group: "inkomen", label: "Uitkering (sociale verzekering)", tax: "box1", perPerson: true, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Bijvoorbeeld WW of een arbeidsongeschiktheidsuitkering." },
  { kind: "pensioen_uitkering", group: "inkomen", label: "Pensioenuitkering", tax: "box1", perPerson: true, oneOff: false, defaultStart: "pensioen", section: "pensioen", help: "Bijvoorbeeld pensioen van een eerdere werkgever. Zonder startjaar: vanaf de pensioenleeftijd." },
  { kind: "lijfrente_uitkering", group: "inkomen", label: "Lijfrente-uitkering", tax: "box1", perPerson: true, oneOff: false, defaultStart: "pensioen", section: "pensioen", help: "Een lijfrente die al uitkeert of een vaste afspraak heeft. Een lijfrente met opgebouwde waarde voegt u toe bij Vermogen." },
  { kind: "overig_inkomen", group: "inkomen", label: "Overig belastbaar inkomen", tax: "box1", perPerson: true, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Bijvoorbeeld resultaat uit overige werkzaamheden of alimentatie." },
  { kind: "eenmalig_inkomen", group: "inkomen", label: "Eenmalig belastbaar inkomen", tax: "box1", perPerson: true, oneOff: true, defaultStart: "nu", section: "inkomen" },
  { kind: "onbelast_inkomen", group: "inkomen", label: "Onbelast inkomen", tax: "onbelast", perPerson: true, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Bijvoorbeeld een erfenis in termijnen of een vrijgestelde uitkering." },
  { kind: "uitgave", group: "uitgave", label: "Uitgaven in een periode", tax: "geen", perPerson: false, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Kosten bovenop de vaste uitgaven, zolang ze duren. Bijvoorbeeld een lening die afloopt." },
  { kind: "studiekosten", group: "uitgave", label: "Studiekosten kind(eren)", tax: "geen", perPerson: false, oneOff: false, defaultStart: "nu", section: "inkomen" },
  { kind: "aftrekbare_gift", group: "uitgave", label: "Aftrekbare giften", tax: "aftrekbaar", perPerson: true, oneOff: false, defaultStart: "nu", section: "inkomen", help: "Giften aan goede doelen (ANBI): aftrekbaar boven 1% van het inkomen." },
  { kind: "eenmalige_uitgave", group: "uitgave", label: "Eenmalige uitgave", tax: "geen", perPerson: false, oneOff: true, defaultStart: "nu", section: "inkomen", help: "Bijvoorbeeld een auto, verbouwing of wereldreis." },
];

export function getCashKind(kind: string): CashKindDef | undefined {
  return CASH_KINDS.find((k) => k.kind === kind);
}
