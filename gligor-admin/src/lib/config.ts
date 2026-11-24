/**
 * Bedrijfsregels op één plek. Pas hier pakketten, bedragen en termijnen aan.
 * Dit bestand mag zowel op de server als in de browser gebruikt worden.
 */

export type Stage =
  | "lead"
  | "kennismaking"
  | "intake"
  | "inrichting"
  | "training"
  | "checkin"
  | "doorlopend"
  | "opgezegd";

export type PackageKey = "basis" | "plus";
export type Channel = "email" | "telefoon" | "whatsapp";
export type SetupType = "microsoft365" | "claude";
export type LogType = "gesprek" | "telefoon" | "email" | "bezoek" | "notitie";
export type TicketStatus = "nieuw" | "open" | "wacht_op_klant" | "opgelost";

export const STAGES: { key: Stage; label: string; short?: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "kennismaking", label: "Kennismaking" },
  { key: "intake", label: "Intake" },
  { key: "inrichting", label: "Inrichting" },
  { key: "training", label: "Training" },
  { key: "checkin", label: "Check-in", short: "Check-in (wk 4)" },
  { key: "doorlopend", label: "Doorlopend" },
  { key: "opgezegd", label: "Opgezegd" },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.key, s.label])) as Record<Stage, string>;

/** Klanten die betalen en waarvoor Gligor actief werk doet. */
export const ACTIVE_STAGES: Stage[] = ["inrichting", "training", "checkin", "doorlopend"];

export const PACKAGES: Record<PackageKey, { label: string; monthlyFee: number; responseWorkingDays: number }> = {
  basis: { label: "Basis", monthlyFee: 100, responseWorkingDays: 2 },
  plus: { label: "Plus", monthlyFee: 200, responseWorkingDays: 1 },
};

export const START_FEE = 250;
/** Betaaltermijn na factuurdatum (start van de periode). */
export const PAYMENT_TERM_DAYS = 14;
/** Onbetaald en binnen zoveel dagen te betalen: status "Openstaand". */
export const PAYMENT_DUE_SOON_DAYS = 7;
/** Geen contact sinds zoveel dagen: "Even bijpraten?". */
export const NO_CONTACT_DAYS = 30;
/** Garantie: minimaal zoveel uur besparing in de eerste maand. */
export const GUARANTEE_HOURS = 4;

export const CHANNEL_LABEL: Record<Channel, string> = { email: "E-mail", telefoon: "Telefoon", whatsapp: "WhatsApp" };
export const SETUP_LABEL: Record<SetupType, string> = { microsoft365: "Microsoft 365 Copilot", claude: "Claude" };
export const LOG_TYPE_LABEL: Record<LogType, string> = {
  gesprek: "Gesprek",
  telefoon: "Telefoon",
  email: "E-mail",
  bezoek: "Bezoek",
  notitie: "Notitie",
};
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  nieuw: "Nieuw",
  open: "Open",
  wacht_op_klant: "Wacht op klant",
  opgelost: "Opgelost",
};

/** Sjabloonsleutels die de levenscyclus gebruikt (zie migratie met startsjablonen). */
export const TEMPLATE_KEYS = {
  welkom: "welkom",
  bevestigingIntake: "bevestiging_intake",
  inrichtingKlaar: "inrichting_klaar",
  checkin2w: "checkin_2w",
  garantie4w: "garantie_4w",
  kwartaalUpdate: "kwartaal_update",
  betaalherinnering: "betaalherinnering",
  bedankt3: "bedankt_3",
  jubileum: "jubileum",
  jubileumJaarlijks: "jubileum_jaarlijks",
  verjaardag: "verjaardag",
  referralBedankt: "referral_bedankt",
  intakelink: "intakelink",
} as const;

export type GiftType = "kaart" | "cadeau" | "diner";
export const GIFT_TYPE_LABEL: Record<GiftType, string> = { kaart: "Kaart", cadeau: "Cadeau", diner: "Diner" };

export type LeadSource = "handmatig" | "website" | "cal" | "email" | "intakelink";
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  handmatig: "Handmatig",
  website: "Website",
  cal: "Cal.com",
  email: "E-mail",
  intakelink: "Intakelink",
};

/** Intakelinks zijn zoveel dagen geldig. */
export const INTAKE_LINK_DAYS = 7;

export const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
