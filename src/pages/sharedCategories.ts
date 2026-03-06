// ─── Shared Category List ─────────────────────────────────────────────────────
// This is the single source of truth for categories used by both the
// CSV Dashboard and the Budget Maker. Edit here to affect both tools.

export const SHARED_CATEGORIES_KEY = "shared_categories_v1";

export const DEFAULT_CATEGORIES = [
  "Housing",
  "Utilities",
  "Groceries",
  "Transport",
  "Dining Out",
  "Health & Fitness",
  "Entertainment",
  "Clothing",
  "Personal Care",
  "Subscriptions",
  "Savings",
  "Investments",
  "Education",
  "Travel",
  "Income",
  "Other",
];

/** Load categories from localStorage, falling back to defaults. */
export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(SHARED_CATEGORIES_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {}
  return [...DEFAULT_CATEGORIES];
}

/** Persist the full category list to localStorage. */
export function saveCategories(cats: string[]): void {
  try {
    localStorage.setItem(SHARED_CATEGORIES_KEY, JSON.stringify(cats));
  } catch {}
}

/** Add a new custom category if it doesn't already exist (case-insensitive). */
export function addCategory(name: string): string[] {
  const cats = loadCategories();
  const trimmed = name.trim();
  if (!trimmed) return cats;
  if (cats.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return cats;
  const updated = [...cats, trimmed];
  saveCategories(updated);
  return updated;
}

/** Category color map — used by both tools for consistent colour coding. */
export const CATEGORY_COLORS: Record<string, string> = {
  Housing:          "#60a5fa",
  Utilities:        "#818cf8",
  Groceries:        "#4ade80",
  Transport:        "#fb923c",
  "Dining Out":     "#f59e0b",
  "Health & Fitness": "#34d399",
  Entertainment:    "#e879f9",
  Clothing:         "#f472b6",
  "Personal Care":  "#f472b6",
  Subscriptions:    "#00e5ff",
  Savings:          "#4ade80",
  Investments:      "#a78bfa",
  Education:        "#38bdf8",
  Travel:           "#fbbf24",
  Income:           "#00e5ff",
  Other:            "#475569",
  // Legacy CSV labels kept for backwards compat
  "Housing & VvE":      "#60a5fa",
  "Insurance":          "#a78bfa",
  "Transport & Fuel":   "#fb923c",
  "Fitness & Health":   "#34d399",
  "Shopping":           "#f87171",
  "Storage & Services": "#94a3b8",
};

export function categoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#475569";
}
