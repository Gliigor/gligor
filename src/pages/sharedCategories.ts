// ─── Shared Category System ───────────────────────────────────────────────────
// Single source of truth for both Budget Maker and CSV Dashboard.

export const SHARED_CATEGORIES_KEY = "shared_categories_v1";

/** The canonical base category list. Order matters — controls display order. */
export const BASE_CATEGORIES: string[] = [
  "Rent / Mortgage",
  "Utilities",
  "Internet",
  "Phone Bill",
  "Groceries",
  "Dining Out",
  "Takeaway / Delivery",
  "Transport",
  "Subscriptions",
  "Savings",
  "Investments",
  "Personal Care",
  "Entertainment",
  "Clothing",
  "Education",
  "Income",
  "Other",
];

/** Load the full list (base + any user-added custom categories). */
export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(SHARED_CATEGORIES_KEY);
    if (raw) {
      const saved: string[] = JSON.parse(raw);
      const custom = saved.filter((c) => !BASE_CATEGORIES.includes(c));
      return [...BASE_CATEGORIES, ...custom];
    }
  } catch {}
  return [...BASE_CATEGORIES];
}

/** Persist the list to localStorage. */
export function saveCategories(cats: string[]): void {
  try { localStorage.setItem(SHARED_CATEGORIES_KEY, JSON.stringify(cats)); } catch {}
}

/** Add a custom category. Returns the updated full list. */
export function addCustomCategory(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return loadCategories();
  const current = loadCategories();
  if (current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return current;
  const updated = [...current, trimmed];
  saveCategories(updated);
  return updated;
}

// ─── Category Colors ──────────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  "Rent / Mortgage":     "#60a5fa",
  "Utilities":           "#818cf8",
  "Internet":            "#6366f1",
  "Phone Bill":          "#8b5cf6",
  "Groceries":           "#4ade80",
  "Dining Out":          "#f59e0b",
  "Takeaway / Delivery": "#fb923c",
  "Transport":           "#38bdf8",
  "Subscriptions":       "#00e5ff",
  "Savings":             "#34d399",
  "Investments":         "#a78bfa",
  "Personal Care":       "#f472b6",
  "Entertainment":       "#e879f9",
  "Clothing":            "#f87171",
  "Education":           "#22d3ee",
  "Income":              "#4ade80",
  "Other":               "#475569",
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#64748b";
}

// ─── CSV Auto-Classification Keywords ────────────────────────────────────────
export const CLASSIFICATION_RULES: { category: string; keywords: string[] }[] = [
  { category: "Groceries",           keywords: ["albert heijn","ah ","ah zeist","lidl","jumbo","aldi","plus supermarkt","dirk","hoogvliet"] },
  { category: "Dining Out",          keywords: ["restaurant","cafe ","café","mcdonalds","burger king","kfc","five guys","wagamama","eetcafe"] },
  { category: "Takeaway / Delivery", keywords: ["thuisbezorgd","uber eats","deliveroo","takeaway","dominos","pizza","just eat"] },
  { category: "Transport",           keywords: ["ns ","ov-chipkaart","ret ","gvb ","htm ","connexxion","arriva","tinq","shell","bp ","esso","total energie","benzine","parkeer","parking","uber","bolt.eu","anwb"] },
  { category: "Subscriptions",       keywords: ["netflix","spotify","disney","hbo","apple.com/bill","youtube premium","amazon prime","bck*","adobe","microsoft 365","chatgpt","openai"] },
  { category: "Rent / Mortgage",     keywords: ["hypotheek","mortgage","huur","rent ","vve"] },
  { category: "Utilities",           keywords: ["vattenfall","nuon","eneco","essent","greenchoice","water","waterschap","gemeente energie"] },
  { category: "Internet",            keywords: ["ziggo","xs4all","kpn internet","odido thuis","t-mobile thuis"] },
  { category: "Phone Bill",          keywords: ["t-mobile","vodafone","tele2","simonly","lebara","kpn mobiel","odido mobiel"] },
  { category: "Personal Care",       keywords: ["kruidvat","etos","trekpleister","douglas","hema","kapper","salon","apotheek","pharmacy"] },
  { category: "Entertainment",       keywords: ["bioscoop","cinema","pathé","vue ","ticketmaster","eventbrite","steam ","playstation","xbox"] },
  { category: "Clothing",            keywords: ["h&m","zara","primark","uniqlo","zalando","wehkamp","mango","jack & jones"] },
  { category: "Education",           keywords: ["udemy","coursera","duolingo","school","universiteit","hogeschool","studie"] },
  { category: "Savings",             keywords: ["spaarrekening","savings transfer","oranje spaarrekening"] },
  { category: "Investments",         keywords: ["degiro","trading 212","bux ","peaks ","meesman","robinhood"] },
  { category: "Income",              keywords: ["salaris","salary","loon","inkomen","dividend"] },
];

export function autoClassify(name: string, description: string): string {
  const hay = `${name} ${description}`.toLowerCase();
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.keywords.some((kw) => hay.includes(kw))) return rule.category;
  }
  return "Other";
}
