import { useState, useCallback, useRef, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";
import {
  loadCategories, saveCategories, addCategory as addSharedCategory,
  categoryColor, SHARED_CATEGORIES_KEY,
} from "./sharedCategories";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string; date: string; name: string; description: string;
  amount: number; category: string; manual?: boolean;
}
interface Subscription {
  name: string; amount: number; frequency: string;
  monthlyEstimate: number; occurrences: number;
}
interface BudgetComparison {
  category: string; budgeted: number; actual: number;
  diff: number; pct: number; status: "under" | "over" | "exact" | "unbudgeted" | "nodata";
}

// ─── Category keyword rules (auto-classify CSV rows) ─────────────────────────
const CATEGORY_RULES: { label: string; keywords: string[] }[] = [
  { label: "Groceries",        keywords: ["albert heijn","ah ","ah zeist","lidl","jumbo","aldi","plus supermarkt","dirk"] },
  { label: "Housing",          keywords: ["vve","hypotheek","mortgage","huur","rent","woning"] },
  { label: "Insurance",        keywords: ["fbto","verzeker","insurance","rheinland","credit life","overlijdens"] },
  { label: "Personal Care",    keywords: ["kruidvat","etos","trekpleister","douglas","hema","kapper","salon"] },
  { label: "Transport",        keywords: ["tinq","shell","bp ","esso","total","benzine","ns ","ov-chipkaart","parkeer","parking"] },
  { label: "Health & Fitness", keywords: ["basic fit","sportschool","gym","apotheek","pharmacy","huisarts","ziekenhuis"] },
  { label: "Income",           keywords: ["salaris","salary","loon","inkomen"] },
  { label: "Entertainment",    keywords: ["netflix","spotify","disney","cinema","bioscoop"] },
  { label: "Dining Out",       keywords: ["restaurant","cafe","mcdonalds","thuisbezorgd","uber eats","takeaway"] },
  { label: "Shopping",         keywords: ["argos","readshop","bol.com","amazon","zalando","h&m","zara","primark","ikea"] },
  { label: "Subscriptions",    keywords: ["bck*","stalling","storage","adobe","microsoft"] },
];

const CSV_STORAGE_KEY  = "budget_dashboard_v1";
const BUDGET_MAKER_KEY = "budget_maker_v1";

function autoClassify(name: string, desc: string): string {
  const hay = `${name} ${desc}`.toLowerCase();
  for (const r of CATEGORY_RULES) {
    if (r.keywords.some((k) => hay.includes(k))) return r.label;
  }
  return "Other";
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split("\n");
  return lines.slice(1).map((line, i) => {
    const fields: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { fields.push(cur); cur = ""; continue; }
      cur += ch;
    }
    fields.push(cur);
    const [date, , amountRaw, , , name, description] = fields;
    const amount = parseAmount(amountRaw ?? "0");
    return {
      id: `csv-${i}`, date: date?.trim() ?? "",
      name: name?.trim() ?? "", description: description?.trim() ?? "",
      amount, category: autoClassify(name ?? "", description ?? ""),
    };
  }).filter((t) => !isNaN(t.amount));
}

function detectSubscriptions(txns: Transaction[]): Subscription[] {
  const expenses = txns.filter((t) => t.amount < 0);
  const grouped: Record<string, Transaction[]> = {};
  for (const t of expenses) {
    const key = t.name.toLowerCase().trim();
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }
  const subs: Subscription[] = [];
  for (const [, group] of Object.entries(grouped)) {
    if (group.length < 2) continue;
    const amounts = group.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / amounts.length;
    if (variance > avg * 0.1) continue;
    const dates = group.map((t) => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i].getTime() - dates[i-1].getTime()) / 86400000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    let frequency = "Irregular", monthlyEstimate = avg;
    if      (avgGap <= 8)   { frequency = "Weekly";    monthlyEstimate = avg * 4.33; }
    else if (avgGap <= 16)  { frequency = "Bi-weekly"; monthlyEstimate = avg * 2.17; }
    else if (avgGap <= 35)  { frequency = "Monthly";   monthlyEstimate = avg; }
    else if (avgGap <= 100) { frequency = "Quarterly"; monthlyEstimate = avg / 3; }
    else                    { frequency = "Annual";    monthlyEstimate = avg / 12; }
    subs.push({ name: group[0].name, amount: avg, frequency, monthlyEstimate, occurrences: group.length });
  }
  return subs.sort((a, b) => b.monthlyEstimate - a.monthlyEstimate);
}

const fmt = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

function downloadCSV(txns: Transaction[]) {
  const header = "Date,Name,Description,Amount,Category";
  const rows = txns.map((t) => `"${t.date}","${t.name}","${t.description}","${t.amount}","${t.category}"`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "budget-export.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 8, padding: "10px 14px", fontFamily: "'Exo 2',sans-serif", fontSize: 12 }}>
        <div style={{ color: "#94a3b8", marginBottom: 4 }}>{payload[0].name}</div>
        <div style={{ color: "#00e5ff", fontWeight: 600 }}>{fmt(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

// ─── Drill-Down Panel ─────────────────────────────────────────────────────────
const DrillDownPanel = ({
  category, transactions, onClose, onRelabel, allCategories,
}: {
  category: string; transactions: Transaction[]; onClose: () => void;
  onRelabel: (id: string, cat: string) => void; allCategories: string[];
}) => {
  const total = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  return (
    <div onClick={handleClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: `rgba(0,0,0,${visible ? 0.7 : 0})`, transition: "background 0.3s", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px,95vw)", height: "100vh", background: "#080e1a", borderLeft: "1px solid rgba(0,229,255,0.15)", transform: visible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", marginBottom: 6, fontFamily: "'Orbitron',sans-serif" }}>CATEGORY DRILL-DOWN</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: categoryColor(category) }} />
              <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{category}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: categoryColor(category), fontFamily: "'Orbitron',sans-serif" }}>{fmt(total)}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{transactions.length} transactions</div>
          </div>
          <button onClick={handleClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
        <div style={{ padding: "16px 28px", flex: 1 }}>
          {[...transactions].sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
            <div key={t.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#e2e8f0", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</div>}
                <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{t.date}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.amount >= 0 ? "#4ade80" : "#f87171", marginBottom: 6 }}>{fmt(t.amount)}</div>
                {/* Relabel dropdown — shown for ALL categories, not just Other */}
                <select
                  value={t.category}
                  onChange={(e) => onRelabel(t.id, e.target.value)}
                  style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${categoryColor(t.category)}55`, borderRadius: 4, padding: "3px 6px", color: categoryColor(t.category), fontFamily: "'Exo 2',sans-serif", fontSize: 10, cursor: "pointer", outline: "none" }}
                >
                  {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Budget vs Actual Modal ───────────────────────────────────────────────────
const BudgetCompareModal = ({ rows, onClose }: { rows: BudgetComparison[]; onClose: () => void }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const close = () => { setVisible(false); setTimeout(onClose, 280); };

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual   = rows.reduce((s, r) => s + r.actual,   0);
  const totalDiff     = totalBudgeted - totalActual;

  const statusBadge = (s: BudgetComparison["status"]) => {
    if (s === "under")      return { label: "✅ Under",      color: "#4ade80", bg: "rgba(74,222,128,0.1)" };
    if (s === "over")       return { label: "⚠️ Over",       color: "#f87171", bg: "rgba(248,113,113,0.1)" };
    if (s === "exact")      return { label: "🎯 Exact",      color: "#00e5ff", bg: "rgba(0,229,255,0.1)" };
    if (s === "unbudgeted") return { label: "🔶 Unbudgeted", color: "#fb923c", bg: "rgba(251,146,60,0.1)" };
    return                         { label: "— No data",    color: "#475569", bg: "rgba(71,85,105,0.1)" };
  };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 200, background: `rgba(0,0,0,${visible ? 0.8 : 0})`, transition: "background 0.28s", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(780px,98vw)", maxHeight: "90vh", overflowY: "auto", background: "#080e1a", border: "1px solid rgba(0,229,255,0.18)", borderRadius: 14, padding: "28px 32px", transform: visible ? "scale(1)" : "scale(0.94)", opacity: visible ? 1 : 0, transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1),opacity 0.28s" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", fontFamily: "'Orbitron',sans-serif", marginBottom: 6 }}>ANALYSIS</div>
            <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e8f0" }}>Budget vs Actual</h2>
          </div>
          <button onClick={close} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 13px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>

        {/* Summary totals */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "TOTAL BUDGETED", value: fmt(totalBudgeted), color: "#60a5fa" },
            { label: "TOTAL SPENT",    value: fmt(totalActual),   color: "#f87171" },
            { label: totalDiff >= 0 ? "SURPLUS" : "DEFICIT", value: fmt(Math.abs(totalDiff)), color: totalDiff >= 0 ? "#4ade80" : "#fb923c" },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "14px 18px" }}>
              <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron',sans-serif", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Orbitron',sans-serif" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {["CATEGORY","BUDGETED","ACTUAL SPENT","DIFFERENCE","USAGE","STATUS"].map((h) => (
                <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron',sans-serif", fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const badge = statusBadge(r.status);
              const barPct = r.budgeted > 0 ? Math.min((r.actual / r.budgeted) * 100, 150) : 0;
              const barColor = barPct > 100 ? "#f87171" : barPct > 85 ? "#fbbf24" : "#4ade80";
              return (
                <tr key={r.category} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "11px 10px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: categoryColor(r.category), flexShrink: 0, display: "inline-block" }} />
                      <span style={{ fontSize: 12, color: "#e2e8f0" }}>{r.category}</span>
                    </span>
                  </td>
                  <td style={{ padding: "11px 10px", fontSize: 12, color: "#60a5fa" }}>{r.budgeted > 0 ? fmt(r.budgeted) : <span style={{ color: "#334155" }}>—</span>}</td>
                  <td style={{ padding: "11px 10px", fontSize: 12, color: r.actual > 0 ? "#f87171" : "#475569" }}>{r.actual > 0 ? fmt(r.actual) : <span style={{ color: "#334155" }}>€0</span>}</td>
                  <td style={{ padding: "11px 10px", fontSize: 12, color: r.diff >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                    {r.status === "unbudgeted" || r.status === "nodata" ? "—" : (r.diff >= 0 ? "+" : "") + fmt(r.diff)}
                  </td>
                  <td style={{ padding: "11px 10px" }}>
                    {r.budgeted > 0 ? (
                      <div style={{ width: 80 }}>
                        <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginBottom: 3 }}>
                          <div style={{ height: "100%", width: `${Math.min(barPct, 100)}%`, background: barColor, borderRadius: 2, transition: "width 0.4s" }} />
                        </div>
                        <span style={{ fontSize: 9, color: "#475569" }}>{Math.min(barPct, 999).toFixed(0)}%</span>
                      </div>
                    ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
                  </td>
                  <td style={{ padding: "11px 10px" }}>
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Donut Chart Row ──────────────────────────────────────────────────────────
const DonutRow = ({
  label, total, color, pieData, onSliceClick,
}: {
  label: string; total: number; color: string;
  pieData: { name: string; value: number }[];
  onSliceClick: (cat: string) => void;
}) => (
  <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: "'Orbitron',sans-serif" }}>{fmt(total)}</div>
      </div>
      <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em" }}>{pieData.length} CATEGORIES</div>
    </div>
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <div style={{ flexShrink: 0 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} dataKey="value" onClick={(d) => onSliceClick(d.name)} style={{ cursor: "pointer" }}>
              {pieData.map((e) => <Cell key={e.name} fill={categoryColor(e.name)} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {pieData.slice(0, 6).map((d) => (
          <div key={d.name} onClick={() => onSliceClick(d.name)}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 8px", borderRadius: 6, transition: "background 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: categoryColor(d.name), flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{d.name}</span>
            </div>
            <span style={{ fontSize: 12, color: "#64748b" }}>{fmt(d.value)}</span>
          </div>
        ))}
        {pieData.length > 6 && <div style={{ fontSize: 10, color: "#334155", paddingLeft: 15 }}>+{pieData.length - 6} more — click chart to explore</div>}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CsvDashboard() {
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [categories,    setCategories]    = useState<string[]>(() => loadCategories());
  const [dragging,      setDragging]      = useState(false);
  const [activeTab,     setActiveTab]     = useState<"overview"|"raw"|"add"|"subscriptions">("overview");
  const [filter,        setFilter]        = useState("All");
  const [editingId,     setEditingId]     = useState<string|null>(null);
  const [drillCategory, setDrillCategory] = useState<string|null>(null);
  const [drillIsIncome, setDrillIsIncome] = useState(false);
  const [hasSaved,      setHasSaved]      = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [showCompare,   setShowCompare]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date: "", name: "", description: "", amount: "", category: categories[0] });

  // Sync categories from localStorage (shared with Budget Maker)
  useEffect(() => {
    const onStorage = () => setCategories(loadCategories());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    try { if (localStorage.getItem(CSV_STORAGE_KEY)) setHasSaved(true); } catch {}
  }, []);

  // Auto-save whenever transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      try { localStorage.setItem(CSV_STORAGE_KEY, JSON.stringify(transactions)); } catch {}
    }
  }, [transactions]);

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setTransactions(parseCSV(e.target?.result as string));
      setActiveTab("overview");
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const saveDashboard = () => {
    try {
      localStorage.setItem(CSV_STORAGE_KEY, JSON.stringify(transactions));
      setHasSaved(true); setSaveMsg("Saved!"); setTimeout(() => setSaveMsg(""), 2000);
    } catch {}
  };

  const restoreSession = () => {
    try {
      const saved = localStorage.getItem(CSV_STORAGE_KEY);
      if (saved) { setTransactions(JSON.parse(saved)); setActiveTab("overview"); }
    } catch {}
  };

  const clearSaved = () => {
    try { localStorage.removeItem(CSV_STORAGE_KEY); setHasSaved(false); } catch {}
  };

  const updateCategory = (id: string, cat: string) => {
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category: cat } : t));
    setEditingId(null);
  };

  // Fix 1: relabel persists + closes drill panel if category no longer matches
  const relabelTransaction = (id: string, cat: string) => {
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category: cat } : t));
  };

  const addManual = () => {
    if (!form.date || !form.name || !form.amount) return;
    setTransactions((prev) => [...prev, {
      id: `manual-${Date.now()}`, date: form.date, name: form.name,
      description: form.description, amount: parseFloat(form.amount),
      category: form.category, manual: true,
    }]);
    setForm({ date: "", name: "", description: "", amount: "", category: categories[0] });
    setActiveTab("raw");
  };

  // ── Derived data ────────────────────────────────────────────────────────
  // Fix 1: strictly separate income vs expenses for drill-down
  const incomeTransactions  = transactions.filter((t) => t.amount > 0);
  const expenseTransactions = transactions.filter((t) => t.amount < 0);
  const totalIn  = incomeTransactions.reduce((s, t) => s + t.amount, 0);
  const totalOut = expenseTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const net      = totalIn - totalOut;

  const incomeByCategory: Record<string, number> = {};
  for (const t of incomeTransactions) incomeByCategory[t.category] = (incomeByCategory[t.category] ?? 0) + t.amount;

  const expenseByCategory: Record<string, number> = {};
  for (const t of expenseTransactions) expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + Math.abs(t.amount);

  const incomePieData  = Object.entries(incomeByCategory).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:parseFloat(value.toFixed(2))}));
  const expensePieData = Object.entries(expenseByCategory).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:parseFloat(value.toFixed(2))}));

  const filteredTxns = filter === "All" ? transactions : transactions.filter((t) => t.category === filter);
  const subscriptions = detectSubscriptions(transactions);

  // Fix 1: drill-down shows only income OR only expense transactions for that category
  const drillTxns = drillCategory
    ? (drillIsIncome ? incomeTransactions : expenseTransactions).filter((t) => t.category === drillCategory)
    : [];

  const openDrill = (cat: string, isIncome: boolean) => {
    setDrillIsIncome(isIncome);
    setDrillCategory(cat);
  };

  // ── Budget vs Actual ─────────────────────────────────────────────────────
  const buildComparisonRows = (): BudgetComparison[] => {
    let budgetData: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(BUDGET_MAKER_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        for (const row of (saved.expenses ?? [])) {
          const amt = parseFloat(row.amount);
          if (!isNaN(amt) && amt > 0) budgetData[row.label] = amt;
        }
      }
    } catch {}

    const allCats = new Set([...Object.keys(budgetData), ...Object.keys(expenseByCategory)]);
    const rows: BudgetComparison[] = [];

    for (const cat of allCats) {
      const budgeted = budgetData[cat] ?? 0;
      const actual   = expenseByCategory[cat] ?? 0;
      const diff     = budgeted - actual;
      const pct      = budgeted > 0 ? (actual / budgeted) * 100 : 0;
      let status: BudgetComparison["status"] = "nodata";
      if (budgeted === 0)         status = "unbudgeted";
      else if (actual === 0)      status = "nodata";
      else if (Math.abs(diff) < 0.01) status = "exact";
      else if (diff > 0)          status = "under";
      else                        status = "over";
      rows.push({ category: cat, budgeted, actual, diff, pct, status });
    }
    return rows.sort((a, b) => b.actual - a.actual);
  };

  const inputStyle = { width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", color: "hsl(var(--foreground))", fontFamily: "'Exo 2',sans-serif", fontSize: 13, outline: "none" };

  const tabs = [
    { id: "overview" as const,      label: "OVERVIEW" },
    { id: "raw" as const,           label: "RAW DATA" },
    { id: "subscriptions" as const, label: `SUBSCRIPTIONS${subscriptions.length ? ` (${subscriptions.length})` : ""}` },
    { id: "add" as const,           label: "+ ADD" },
  ];

  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2',sans-serif" }}>
      <ConstellationBackground />
      <Header />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">

        {/* Title */}
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Finance Tool</p>
          <h1 className="text-4xl font-bold text-foreground mb-4" style={{ fontFamily: "'Orbitron',sans-serif" }}>Budget Dashboard</h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">Upload your BUNQ CSV export and get instant visual breakdowns of your spending.</p>
        </div>

        {/* Restore banner */}
        {hasSaved && transactions.length === 0 && (
          <div style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 10, padding: "16px 24px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", letterSpacing: "0.1em", marginBottom: 4 }}>SAVED SESSION FOUND</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>You have a previously saved dashboard.</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={restoreSession} style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 6, padding: "8px 16px", color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>RESTORE</button>
              <button onClick={clearSaved} style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "8px 16px", color: "#f87171", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>CLEAR</button>
            </div>
          </div>
        )}

        {/* Drop Zone */}
        {transactions.length === 0 ? (
          <div onDragOver={(e)=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={onDrop} onClick={()=>fileRef.current?.click()} className="cursor-pointer mx-auto max-w-lg"
            style={{ border:`2px dashed ${dragging?"hsl(var(--primary))":"rgba(0,229,255,0.2)"}`, borderRadius:12, padding:"64px 40px", textAlign:"center", background:dragging?"rgba(0,229,255,0.03)":"rgba(0,229,255,0.01)", transition:"all 0.3s" }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:"none" }} onChange={(e)=>e.target.files?.[0]&&loadFile(e.target.files[0])} />
            <div style={{ fontSize:36, marginBottom:16 }}>📂</div>
            <div className="text-foreground font-semibold mb-2" style={{ fontFamily:"'Orbitron',sans-serif", fontSize:15, letterSpacing:"0.05em" }}>DROP YOUR BUNQ CSV</div>
            <div className="text-muted-foreground text-xs tracking-wider">or click to browse</div>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
              <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{transactions.length} transactions loaded</span>
              <div className="flex gap-3 flex-wrap">
                {saveMsg && <span style={{ fontSize:11, color:"#00e5ff", alignSelf:"center", letterSpacing:"0.1em" }}>{saveMsg}</span>}
                <button onClick={()=>setShowCompare(true)} style={{ background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.3)", borderRadius:6, padding:"8px 14px", color:"#fbbf24", fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:"0.1em", cursor:"pointer" }}>
                  ⚖️ COMPARE WITH BUDGET
                </button>
                <button onClick={saveDashboard} className="text-xs tracking-widest px-4 py-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all" style={{ fontFamily:"'Orbitron',sans-serif" }}>💾 SAVE</button>
                {hasSaved && <button onClick={clearSaved} className="text-xs tracking-widest px-4 py-2 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all" style={{ fontFamily:"'Orbitron',sans-serif" }}>CLEAR SAVED</button>}
                <button onClick={()=>downloadCSV(transactions)} className="text-xs tracking-widest px-4 py-2 rounded border border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all" style={{ fontFamily:"'Orbitron',sans-serif" }}>↓ EXPORT</button>
                <button onClick={()=>{setTransactions([]);setActiveTab("overview");}} className="text-xs tracking-widest px-4 py-2 rounded border border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all" style={{ fontFamily:"'Orbitron',sans-serif" }}>↺ NEW FILE</button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label:"TOTAL INCOME",   value:fmt(totalIn),  color:"#4ade80" },
                { label:"TOTAL EXPENSES", value:fmt(totalOut), color:"#f87171" },
                { label:"NET BALANCE",    value:fmt(net),      color:net>=0?"hsl(var(--primary))":"#fb923c" },
              ].map((s)=>(
                <div key={s.label} className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-3 uppercase">{s.label}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily:"'Orbitron',sans-serif", color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border/40 mb-8 overflow-x-auto">
              {tabs.map((tab)=>(
                <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{ fontFamily:"'Orbitron',sans-serif", color:activeTab===tab.id?"hsl(var(--primary))":"hsl(var(--muted-foreground))", borderBottom:activeTab===tab.id?"2px solid hsl(var(--primary))":"2px solid transparent", background:"none", border:"none", borderBottom:activeTab===tab.id?"2px solid hsl(var(--primary))":"2px solid transparent", padding:"10px 16px", fontSize:10, letterSpacing:"0.12em", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.2s" }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW ──────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Fix 1: income slice click → income-only drill */}
                <DonutRow label="ROW 1 — INCOME"   total={totalIn}  color="#4ade80" pieData={incomePieData}  onSliceClick={(cat) => openDrill(cat, true)} />
                {/* Fix 1: expense slice click → expense-only drill */}
                <DonutRow label="ROW 2 — EXPENSES" total={totalOut} color="#f87171" pieData={expensePieData} onSliceClick={(cat) => openDrill(cat, false)} />
                {/* Category breakdown table */}
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">Full Category Breakdown — click to drill down</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                        {["Category","Transactions","Total","% of Expenses"].map((h)=>(
                          <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:"#475569", letterSpacing:"0.12em", fontWeight:500, fontFamily:"'Orbitron',sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(expenseByCategory).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>{
                        const count = expenseTransactions.filter((t)=>t.category===cat).length;
                        const pct = totalOut>0?((total/totalOut)*100).toFixed(1):"0";
                        return (
                          <tr key={cat} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)", cursor:"pointer" }} className="hover:bg-white/[0.02] transition-colors" onClick={()=>openDrill(cat,false)}>
                            <td style={{ padding:"10px 12px" }}><span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:11, background:categoryColor(cat)+"22", color:categoryColor(cat) }}>{cat}</span></td>
                            <td style={{ padding:"10px 12px", color:"#64748b", fontSize:12 }}>{count}</td>
                            <td style={{ padding:"10px 12px", color:"#f87171", fontSize:12 }}>{fmt(total)}</td>
                            <td style={{ padding:"10px 12px" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                <div style={{ height:3, width:80, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${pct}%`, background:categoryColor(cat), borderRadius:2 }} />
                                </div>
                                <span style={{ color:"#64748b", fontSize:11 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── RAW DATA ──────────────────────────────────────────────── */}
            {activeTab === "raw" && (
              <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{filteredTxns.length} entries</div>
                  <select value={filter} onChange={(e)=>setFilter(e.target.value)}
                    style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"6px 12px", color:"hsl(var(--foreground))", fontFamily:"'Exo 2',sans-serif", fontSize:12, outline:"none" }}>
                    <option value="All">All Categories</option>
                    {categories.map((c)=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                        {["Date","Name","Description","Amount","Category",""].map((h)=>(
                          <th key={h} style={{ padding:"8px 10px", textAlign:"left", fontSize:10, color:"#475569", letterSpacing:"0.12em", fontWeight:500, fontFamily:"'Orbitron',sans-serif", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredTxns].sort((a,b)=>b.date.localeCompare(a.date)).map((t)=>(
                        <tr key={t.id} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding:"9px 10px", color:"#475569", whiteSpace:"nowrap" }}>{t.date}</td>
                          <td style={{ padding:"9px 10px", color:"hsl(var(--foreground))", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.name}</td>
                          <td style={{ padding:"9px 10px", color:"#64748b", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.description}</td>
                          <td style={{ padding:"9px 10px", whiteSpace:"nowrap", color:t.amount>=0?"#4ade80":"#f87171", fontWeight:600 }}>{fmt(t.amount)}</td>
                          <td style={{ padding:"9px 10px" }}>
                            {/* Fix 2: inline category edit on every row */}
                            {editingId === t.id ? (
                              <select defaultValue={t.category} onChange={(e)=>updateCategory(t.id,e.target.value)} onBlur={()=>setEditingId(null)} autoFocus
                                style={{ background:"rgba(0,0,0,0.6)", border:"1px solid hsl(var(--primary))", borderRadius:6, padding:"3px 8px", color:"hsl(var(--foreground))", fontFamily:"'Exo 2',sans-serif", fontSize:11, outline:"none" }}>
                                {categories.map((c)=><option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <span onClick={()=>setEditingId(t.id)} title="Click to relabel"
                                style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"3px 10px", borderRadius:20, fontSize:11, background:categoryColor(t.category)+"22", color:categoryColor(t.category), cursor:"pointer" }}>
                                {t.category} <span style={{ fontSize:9, opacity:0.6 }}>✎</span>
                              </span>
                            )}
                          </td>
                          <td style={{ padding:"9px 10px" }}>
                            <button onClick={()=>setTransactions((prev)=>prev.filter((x)=>x.id!==t.id))}
                              style={{ background:"rgba(248,113,113,0.1)", border:"none", borderRadius:4, padding:"3px 10px", color:"#f87171", fontSize:11, cursor:"pointer" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SUBSCRIPTIONS ─────────────────────────────────────────── */}
            {activeTab === "subscriptions" && (
              <div className="space-y-4">
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Auto-Detected Recurring Payments</div>
                  <div className="text-xs text-muted-foreground mb-6">Payments with similar amounts appearing multiple times are flagged as subscriptions.</div>
                  {subscriptions.length === 0 ? (
                    <div style={{ textAlign:"center", padding:"40px 0", color:"#334155", fontSize:13 }}>No recurring payments detected yet.</div>
                  ) : (
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                      <thead>
                        <tr style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                          {["Merchant","Amount","Frequency","Occurrences","Est. Monthly Cost"].map((h)=>(
                            <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:10, color:"#475569", letterSpacing:"0.12em", fontWeight:500, fontFamily:"'Orbitron',sans-serif" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((s)=>(
                          <tr key={s.name} style={{ borderBottom:"1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                            <td style={{ padding:"10px 12px", color:"#e2e8f0" }}>{s.name}</td>
                            <td style={{ padding:"10px 12px", color:"#f87171" }}>{fmt(s.amount)}</td>
                            <td style={{ padding:"10px 12px" }}><span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontSize:11, background:"rgba(0,229,255,0.1)", color:"#00e5ff" }}>{s.frequency}</span></td>
                            <td style={{ padding:"10px 12px", color:"#64748b" }}>{s.occurrences}×</td>
                            <td style={{ padding:"10px 12px", color:"#fb923c", fontWeight:600 }}>{fmt(s.monthlyEstimate)}/mo</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {subscriptions.length > 0 && (
                    <div style={{ marginTop:16, padding:"12px 16px", background:"rgba(251,146,60,0.05)", border:"1px solid rgba(251,146,60,0.15)", borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:11, color:"#94a3b8", letterSpacing:"0.08em" }}>ESTIMATED TOTAL MONTHLY SUBSCRIPTIONS</span>
                      <span style={{ fontSize:16, fontWeight:700, color:"#fb923c", fontFamily:"'Orbitron',sans-serif" }}>{fmt(subscriptions.reduce((s,sub)=>s+sub.monthlyEstimate,0))}/mo</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ADD ENTRY ─────────────────────────────────────────────── */}
            {activeTab === "add" && (
              <div className="border border-border/60 rounded-lg p-8 bg-card/40 backdrop-blur-sm max-w-lg hover:border-primary/40 transition-all duration-500">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-8">Manually Add Transaction</div>
                <div className="space-y-5">
                  {[
                    { label:"DATE",type:"date",key:"date",placeholder:"" },
                    { label:"NAME / MERCHANT",type:"text",key:"name",placeholder:"e.g. Albert Heijn" },
                    { label:"DESCRIPTION (optional)",type:"text",key:"description",placeholder:"Optional note" },
                    { label:"AMOUNT (use − for expenses)",type:"number",key:"amount",placeholder:"-25.50" },
                  ].map((field)=>(
                    <div key={field.key}>
                      <label style={{ display:"block", fontSize:10, letterSpacing:"0.15em", color:"#475569", marginBottom:6, fontFamily:"'Orbitron',sans-serif" }}>{field.label}</label>
                      <input type={field.type} placeholder={field.placeholder} value={(form as any)[field.key]}
                        onChange={(e)=>setForm({...form,[field.key]:e.target.value})} style={inputStyle}
                        onFocus={(e)=>e.target.style.borderColor="hsl(var(--primary))"}
                        onBlur={(e)=>e.target.style.borderColor="rgba(255,255,255,0.08)"} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display:"block", fontSize:10, letterSpacing:"0.15em", color:"#475569", marginBottom:6, fontFamily:"'Orbitron',sans-serif" }}>CATEGORY</label>
                    <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} style={inputStyle}>
                      {categories.map((c)=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button onClick={addManual} className="w-full mt-2 px-6 py-3 rounded border border-primary/50 text-primary hover:bg-primary/10 transition-all duration-300 tracking-widest text-xs" style={{ fontFamily:"'Orbitron',sans-serif" }}>
                    + ADD TRANSACTION
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Drill-down panel */}
      {drillCategory && (
        <DrillDownPanel
          category={drillCategory}
          transactions={drillTxns}
          onClose={()=>setDrillCategory(null)}
          onRelabel={relabelTransaction}
          allCategories={categories}
        />
      )}

      {/* Budget compare modal */}
      {showCompare && (
        <BudgetCompareModal
          rows={buildComparisonRows()}
          onClose={()=>setShowCompare(false)}
        />
      )}
    </div>
  );
}
