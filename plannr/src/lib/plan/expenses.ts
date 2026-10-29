// Household expense categories, after the main groups of the Nibud budget.
// Used by the Uitgaven step and by the downloadable expense sheet, so a
// client's filled-in sheet maps one-to-one onto the plan.

export const EXPENSE_GROUPS = [
  { key: "vast", label: "Vaste lasten" },
  { key: "reservering", label: "Reserveringsuitgaven" },
  { key: "huishouden", label: "Huishoudelijke uitgaven" },
] as const;
export type ExpenseGroup = (typeof EXPENSE_GROUPS)[number]["key"];

export const EXPENSE_CATEGORIES = [
  { key: "wonen", group: "vast", label: "Woonlasten", items: ["Huur of hypotheek (rente en aflossing)", "Servicekosten / VvE"] },
  {
    key: "energie",
    group: "vast",
    label: "Energie & lokale lasten",
    items: ["Gas en elektriciteit", "Water", "Onroerendezaakbelasting", "Reinigings- en rioolheffing", "Waterschapslasten"],
  },
  {
    key: "verzekeringen",
    group: "vast",
    label: "Verzekeringen",
    items: ["Zorgverzekering (basis en aanvullend)", "Aansprakelijkheid", "Inboedel en opstal", "Uitvaart en overlijdensrisico", "Overige (reis, rechtsbijstand, AOV)"],
  },
  { key: "abonnementen", group: "vast", label: "Abonnementen & telecom", items: ["Televisie en internet", "Mobiele telefoon", "Contributies en abonnementen"] },
  { key: "onderwijs", group: "vast", label: "Onderwijs & kinderopvang", items: ["School- en studiekosten kinderen", "Kinderopvang"] },
  { key: "vervoer", group: "vast", label: "Vervoer", items: ["Auto (verzekering, belasting, brandstof, onderhoud)", "Openbaar vervoer", "Fiets"] },
  { key: "overig_vast", group: "vast", label: "Overige vaste lasten", items: ["Alimentatie", "Aflossing andere leningen", "Overig"] },
  { key: "kleding", group: "reservering", label: "Kleding & schoenen", items: ["Kleding", "Schoenen"] },
  { key: "inboedel", group: "reservering", label: "Inboedel, huis & tuin", items: ["Meubels, apparatuur, stoffering", "Onderhoud huis en tuin"] },
  { key: "zorgkosten", group: "reservering", label: "Niet-vergoede ziektekosten", items: ["Eigen risico", "Zelfzorgmedicijnen", "Tandarts en overige zorg"] },
  { key: "vrije_tijd", group: "reservering", label: "Vrije tijd & vakanties", items: ["Vakanties en weekendjes weg", "Hobby's en sport", "Uitgaan en entertainment"] },
  { key: "huishouden", group: "huishouden", label: "Huishoudelijke uitgaven", items: ["Boodschappen", "Persoonlijke verzorging", "Huisdieren"] },
  { key: "giften", group: "huishouden", label: "Giften & overig", items: ["Goede doelen en giften", "Cadeaus", "Overige uitgaven"] },
] as const satisfies readonly { key: string; group: ExpenseGroup; label: string; items: readonly string[] }[];

export type ExpenseKey = (typeof EXPENSE_CATEGORIES)[number]["key"];
export const EXPENSE_KEYS = EXPENSE_CATEGORIES.map((c) => c.key) as ExpenseKey[];

/** Yearly amounts per category; absent or null means not filled in. */
export type ExpenseAmounts = Partial<Record<ExpenseKey, number | null>>;

export function isExpenseKey(value: string): value is ExpenseKey {
  return (EXPENSE_KEYS as string[]).includes(value);
}

/** Whether the plan uses categories (then the yearly total is their sum). */
export function usesCategories(amounts: ExpenseAmounts): boolean {
  return EXPENSE_KEYS.some((k) => typeof amounts[k] === "number");
}

export function expenseTotal(amounts: ExpenseAmounts): number {
  return EXPENSE_KEYS.reduce((sum, k) => sum + (amounts[k] ?? 0), 0);
}

export function groupTotal(amounts: ExpenseAmounts, group: ExpenseGroup): number {
  return EXPENSE_CATEGORIES.filter((c) => c.group === group).reduce((sum, c) => sum + (amounts[c.key] ?? 0), 0);
}
