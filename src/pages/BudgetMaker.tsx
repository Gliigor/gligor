import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";
import { categoryColor, addCustomCategory, BASE_CATEGORIES } from "./sharedCategories";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomeRow  { id: string; label: string; amount: string; }
interface ExpenseRow { id: string; label: string; amount: string; locked: boolean; }
interface SubRow     { id: string; label: string; amount: string; }
interface SavedBudget {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  subscriptions: SubRow[];
  savedAt: string;
}
interface BudgetComparison {
  category: string; budgeted: number; actual: number;
  diff: number; pct: number;
  status: "under" | "over" | "exact" | "unbudgeted" | "nodata";
}

const STORAGE_KEY = "budget_maker_v1";
const CSV_KEY     = "budget_dashboard_v1";

const fmt      = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
const parseAmt = (s: string) => { const n = parseFloat(s.replace(",", ".")); return isNaN(n) ? 0 : n; };
const uid      = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Base locked expense rows ─────────────────────────────────────────────────
const BASE_EXPENSES: ExpenseRow[] = [
  { id: "b1",  label: "Rent / Mortgage",     amount: "", locked: true },
  { id: "b2",  label: "Utilities",           amount: "", locked: true },
  { id: "b3",  label: "Internet",            amount: "", locked: true },
  { id: "b4",  label: "Phone Bill",          amount: "", locked: true },
  { id: "b5",  label: "Groceries",           amount: "", locked: true },
  { id: "b6",  label: "Dining Out",          amount: "", locked: true },
  { id: "b7",  label: "Takeaway / Delivery", amount: "", locked: true },
  { id: "b8",  label: "Transport",           amount: "", locked: true },
  { id: "b9",  label: "Savings",             amount: "", locked: true },
  { id: "b10", label: "Investments",         amount: "", locked: true },
  { id: "b11", label: "Personal Care",       amount: "", locked: true },
  { id: "b12", label: "Entertainment",       amount: "", locked: true },
  { id: "b13", label: "Clothing",            amount: "", locked: true },
  { id: "b14", label: "Education",           amount: "", locked: true },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const IS: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8, padding: "9px 13px", color: "#e2e8f0",
  fontFamily: "'Exo 2',sans-serif", fontSize: 13,
  outline: "none", transition: "border-color 0.2s", width: "100%",
};
const amtIS: React.CSSProperties  = { ...IS, width: 130, textAlign: "right", flexShrink: 0 };
const delBtnS: React.CSSProperties = {
  background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)",
  borderRadius: 6, padding: "8px 12px", color: "#f87171",
  fontSize: 13, cursor: "pointer", flexShrink: 0,
};
const sectionS: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14,
  padding: "28px 32px", background: "rgba(255,255,255,0.015)",
  backdropFilter: "blur(8px)", marginBottom: 24,
};

const AnimRow = ({ children, visible }: { children: React.ReactNode; visible: boolean }) => (
  <div style={{
    display: "flex", gap: 10, alignItems: "center",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(-8px)",
    transition: "opacity 0.25s ease, transform 0.25s ease",
    marginBottom: 10,
  }}>
    {children}
  </div>
);

const GroupDivider = ({ label }: { label: string }) => (
  <div style={{
    fontSize: 9, letterSpacing: "0.2em", color: "#334155",
    fontFamily: "'Orbitron',sans-serif",
    padding: "12px 0 6px", borderBottom: "1px solid rgba(255,255,255,0.04)",
    marginBottom: 8,
  }}>
    {label}
  </div>
);

// ─── Compare Modal (shared component) ────────────────────────────────────────
const CompareModal = ({ rows, onClose }: { rows: BudgetComparison[]; onClose: () => void }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const close = () => { setVisible(false); setTimeout(onClose, 280); };

  const totalBudgeted = rows.reduce((s, r) => s + r.budgeted, 0);
  const totalActual   = rows.reduce((s, r) => s + r.actual,   0);
  const totalDiff     = totalBudgeted - totalActual;

  const badge = (s: BudgetComparison["status"]) => {
    if (s === "under")      return { label: "✅ Under",      color: "#4ade80", bg: "rgba(74,222,128,0.1)" };
    if (s === "over")       return { label: "⚠️ Over",       color: "#f87171", bg: "rgba(248,113,113,0.1)" };
    if (s === "exact")      return { label: "🎯 Exact",      color: "#00e5ff", bg: "rgba(0,229,255,0.1)" };
    if (s === "unbudgeted") return { label: "🔶 Unbudgeted", color: "#fb923c", bg: "rgba(251,146,60,0.1)" };
    return                         { label: "— No data",    color: "#475569", bg: "rgba(71,85,105,0.1)" };
  };

  return (
    <div onClick={close} style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: `rgba(0,0,0,${visible ? 0.8 : 0})`, transition: "background 0.28s",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "min(800px,98vw)", maxHeight: "90vh", overflowY: "auto",
        background: "#080e1a", border: "1px solid rgba(0,229,255,0.18)", borderRadius: 14,
        padding: "28px 32px",
        transform: visible ? "scale(1)" : "scale(0.94)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", fontFamily: "'Orbitron',sans-serif", marginBottom: 6 }}>ANALYSIS</div>
            <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e8f0" }}>Budget vs Actual</h2>
          </div>
          <button onClick={close} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 13px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>

        {/* Summary cards */}
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

        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#334155", fontSize: 13 }}>
            No CSV data found. Load and save a CSV in the Budget Dashboard first.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 580 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {["CATEGORY", "BUDGETED", "ACTUAL SPENT", "DIFFERENCE", "USAGE", "STATUS"].map((h) => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron',sans-serif", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const b       = badge(r.status);
                  const barPct  = r.budgeted > 0 ? Math.min((r.actual / r.budgeted) * 100, 150) : 0;
                  const barClr  = barPct > 100 ? "#f87171" : barPct > 85 ? "#fbbf24" : "#4ade80";
                  return (
                    <tr key={r.category} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "11px 10px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: categoryColor(r.category), flexShrink: 0, display: "inline-block" }} />
                          <span style={{ fontSize: 12, color: "#e2e8f0" }}>{r.category}</span>
                        </span>
                      </td>
                      <td style={{ padding: "11px 10px", fontSize: 12, color: "#60a5fa" }}>
                        {r.budgeted > 0 ? fmt(r.budgeted) : <span style={{ color: "#334155" }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 10px", fontSize: 12, color: r.actual > 0 ? "#f87171" : "#475569" }}>
                        {r.actual > 0 ? fmt(r.actual) : <span style={{ color: "#334155" }}>€0</span>}
                      </td>
                      <td style={{ padding: "11px 10px", fontSize: 12, fontWeight: 600, color: r.diff >= 0 ? "#4ade80" : "#f87171" }}>
                        {r.status === "unbudgeted" || r.status === "nodata"
                          ? "—"
                          : (r.diff >= 0 ? "+" : "") + fmt(r.diff)}
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        {r.budgeted > 0 ? (
                          <div style={{ width: 80 }}>
                            <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden", marginBottom: 3 }}>
                              <div style={{ height: "100%", width: `${Math.min(barPct, 100)}%`, background: barClr, borderRadius: 2, transition: "width 0.4s" }} />
                            </div>
                            <span style={{ fontSize: 9, color: "#475569" }}>{Math.min(barPct, 999).toFixed(0)}%</span>
                          </div>
                        ) : <span style={{ color: "#334155", fontSize: 10 }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 10px" }}>
                        <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: b.bg, color: b.color, whiteSpace: "nowrap" }}>{b.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BudgetMaker() {
  const [income,        setIncome]        = useState<IncomeRow[]>([{ id: "i1", label: "Salary", amount: "" }]);
  const [expenses,      setExpenses]      = useState<ExpenseRow[]>(BASE_EXPENSES);
  const [subscriptions, setSubscriptions] = useState<SubRow[]>([]);
  const [savedAt,       setSavedAt]       = useState<string | null>(null);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [rowVis,        setRowVis]        = useState<Record<string, boolean>>({});
  const [showCompare,   setShowCompare]   = useState(false);

  // ── Load from localStorage on mount ─────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d: SavedBudget = JSON.parse(raw);
        // Restore amounts onto locked base rows, re-attach any saved custom rows
        const restored = BASE_EXPENSES.map((base) => {
          const saved = d.expenses?.find((e) => e.label === base.label);
          return saved ? { ...base, amount: saved.amount } : base;
        });
        const customRows = (d.expenses ?? []).filter(
          (e) => !e.locked && !BASE_EXPENSES.some((b) => b.label === e.label)
        );
        setExpenses([...restored, ...customRows]);
        if (d.income)        setIncome(d.income);
        if (d.subscriptions) setSubscriptions(d.subscriptions);
        setSavedAt(d.savedAt);
      }
    } catch {}
  }, []);

  // Animate all rows visible after mount
  useEffect(() => {
    const ids = [...income, ...expenses, ...subscriptions].map((r) => r.id);
    const vis: Record<string, boolean> = {};
    ids.forEach((id) => { vis[id] = true; });
    setTimeout(() => setRowVis(vis), 10);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived totals ───────────────────────────────────────────────────────
  const totalIncome        = income.reduce((s, r) => s + parseAmt(r.amount), 0);
  const totalSubscriptions = subscriptions.reduce((s, r) => s + parseAmt(r.amount), 0);
  const totalExpenses      = expenses.reduce((s, r) => s + parseAmt(r.amount), 0) + totalSubscriptions;
  const remaining          = totalIncome - totalExpenses;
  const allocPct           = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0;

  // ── Income handlers ──────────────────────────────────────────────────────
  const addIncome = () => {
    const id = uid();
    setIncome((p) => [...p, { id, label: "", amount: "" }]);
    setTimeout(() => setRowVis((v) => ({ ...v, [id]: true })), 10);
  };
  const removeIncome = (id: string) => {
    setRowVis((v) => ({ ...v, [id]: false }));
    setTimeout(() => setIncome((p) => p.filter((r) => r.id !== id)), 260);
  };

  // ── Custom expense handlers ───────────────────────────────────────────────
  const addExpense = () => {
    const id = uid();
    setExpenses((p) => [...p, { id, label: "", amount: "", locked: false }]);
    setTimeout(() => setRowVis((v) => ({ ...v, [id]: true })), 10);
  };
  const removeExpense = (id: string) => {
    setRowVis((v) => ({ ...v, [id]: false }));
    setTimeout(() => setExpenses((p) => p.filter((r) => r.id !== id)), 260);
  };

  // ── Subscription handlers ─────────────────────────────────────────────────
  const addSubscription = () => {
    const id = uid();
    setSubscriptions((p) => [...p, { id, label: "", amount: "" }]);
    setTimeout(() => setRowVis((v) => ({ ...v, [id]: true })), 10);
  };
  const removeSubscription = (id: string) => {
    setRowVis((v) => ({ ...v, [id]: false }));
    setTimeout(() => setSubscriptions((p) => p.filter((r) => r.id !== id)), 260);
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const saveBudget = useCallback(() => {
    try {
      const now = new Date().toLocaleString("nl-NL");
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ income, expenses, subscriptions, savedAt: now }));
      // Push any new custom category names into the shared list
      expenses.filter((e) => !e.locked && e.label.trim()).forEach((e) => addCustomCategory(e.label));
      setSavedAt(now);
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {}
  }, [income, expenses, subscriptions]);

  const resetBudget = () => {
    if (!window.confirm("Reset everything? This cannot be undone.")) return;
    setIncome([{ id: "i1", label: "Salary", amount: "" }]);
    setExpenses(BASE_EXPENSES);
    setSubscriptions([]);
    setSavedAt(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  // ── Budget vs Actual comparison ───────────────────────────────────────────
  const buildRows = (): BudgetComparison[] => {
    // Build budget map from current expense rows
    const budgetMap: Record<string, number> = {};
    for (const row of expenses) {
      const amt = parseAmt(row.amount);
      if (amt > 0) budgetMap[row.label] = (budgetMap[row.label] ?? 0) + amt;
    }
    // Subscriptions bucket = sum of all named sub-rows
    if (totalSubscriptions > 0) budgetMap["Subscriptions"] = totalSubscriptions;

    // Read actual spending from CSV localStorage
    const actualMap: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(CSV_KEY);
      if (raw) {
        const txns: { amount: number; category: string }[] = JSON.parse(raw);
        for (const t of txns) {
          if (t.amount < 0) actualMap[t.category] = (actualMap[t.category] ?? 0) + Math.abs(t.amount);
        }
      }
    } catch {}

    const allCats = new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)]);
    const rows: BudgetComparison[] = [];

    for (const cat of allCats) {
      if (cat === "Income") continue;
      const budgeted = budgetMap[cat] ?? 0;
      const actual   = actualMap[cat]  ?? 0;
      const diff     = budgeted - actual;
      const pct      = budgeted > 0 ? (actual / budgeted) * 100 : 0;
      let status: BudgetComparison["status"] = "nodata";
      if (budgeted === 0)              status = "unbudgeted";
      else if (actual === 0)           status = "nodata";
      else if (Math.abs(diff) < 0.01) status = "exact";
      else if (diff > 0)              status = "under";
      else                            status = "over";
      rows.push({ category: cat, budgeted, actual, diff, pct, status });
    }
    return rows.sort((a, b) => b.actual - a.actual);
  };

  const fb = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "rgba(0,229,255,0.4)");
  const bb = (e: React.FocusEvent<HTMLInputElement>) => (e.target.style.borderColor = "rgba(255,255,255,0.07)");

  // ── Group slices for rendering ────────────────────────────────────────────
  const fixedMonthly = expenses.filter((r) => ["Rent / Mortgage","Utilities","Internet","Phone Bill"].includes(r.label));
  const foodDrink    = expenses.filter((r) => ["Groceries","Dining Out","Takeaway / Delivery"].includes(r.label));
  const transport    = expenses.filter((r) => r.label === "Transport");
  const savingsFin   = expenses.filter((r) => ["Savings","Investments"].includes(r.label));
  const lifestyle    = expenses.filter((r) => ["Personal Care","Entertainment","Clothing","Education"].includes(r.label));
  const customRows   = expenses.filter((r) => !r.locked);

  const renderRow = (r: ExpenseRow) => {
    const amt = parseAmt(r.amount);
    const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
    return (
      <AnimRow key={r.id} visible={rowVis[r.id] ?? true}>
        {/* Category label cell */}
        <div style={{ flex: 1, position: "relative" }}>
          {r.locked ? (
            // Locked: read-only display with lock icon
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "9px 13px", borderRadius: 8,
              background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)",
            }}>
              <span style={{ fontSize: 11, color: "#334155", flexShrink: 0 }}>🔒</span>
              <span style={{ fontSize: 13, color: "#64748b", flex: 1 }}>{r.label}</span>
              {amt > 0 && (
                <span style={{ fontSize: 10, color: "#334155" }}>{pct.toFixed(0)}%</span>
              )}
            </div>
          ) : (
            // Unlocked: editable input
            <>
              <input
                type="text"
                placeholder="Category name…"
                value={r.label}
                onChange={(e) => setExpenses((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))}
                style={{ ...IS, paddingRight: amt > 0 ? 48 : 13 }}
                onFocus={fb} onBlur={bb}
              />
              {amt > 0 && (
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#334155", pointerEvents: "none" }}>{pct.toFixed(0)}%</span>
              )}
            </>
          )}
        </div>
        {/* Amount input — always editable */}
        <input
          type="number"
          placeholder="0.00"
          value={r.amount}
          onChange={(e) => setExpenses((p) => p.map((x) => x.id === r.id ? { ...x, amount: e.target.value } : x))}
          style={{ ...amtIS, color: amt > 0 ? "#f87171" : "#475569" }}
          onFocus={fb} onBlur={bb}
        />
        {/* Delete only for unlocked rows */}
        {r.locked
          ? <div style={{ width: 43, flexShrink: 0 }} />
          : <button onClick={() => removeExpense(r.id)} style={delBtnS}>✕</button>}
      </AnimRow>
    );
  };

  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2',sans-serif" }}>
      <ConstellationBackground />
      <Header />

      {/* ── Sticky Summary Bar ───────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,8,18,0.92)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,229,255,0.1)", padding: "12px 24px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            {[
              { label: "INCOME",    value: fmt(totalIncome),   color: "#4ade80" },
              { label: "BUDGETED",  value: fmt(totalExpenses), color: "#f87171" },
              { label: "REMAINING", value: fmt(remaining),     color: remaining >= 0 ? "#00e5ff" : "#fb923c" },
            ].map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                {i > 0 && <span style={{ color: "#1e293b", fontSize: 16 }}>{i === 1 ? "−" : "="}</span>}
                <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron',sans-serif" }}>{s.label}</span>
                <span style={{ fontSize: i === 2 ? 20 : 18, fontWeight: i === 2 ? 800 : 700, color: s.color, fontFamily: "'Orbitron',sans-serif", transition: "color 0.3s" }}>{s.value}</span>
              </div>
            ))}
            {savedAt && <div style={{ marginLeft: "auto", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>SAVED {savedAt}</div>}
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${allocPct}%`, background: allocPct > 95 ? "#fb923c" : allocPct > 80 ? "#fbbf24" : "#00e5ff", borderRadius: 2, transition: "width 0.4s, background 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "#334155" }}>0%</span>
            <span style={{ fontSize: 9, color: allocPct > 95 ? "#fb923c" : "#334155" }}>{allocPct.toFixed(0)}% ALLOCATED</span>
            <span style={{ fontSize: 9, color: "#334155" }}>100%</span>
          </div>
        </div>
      </div>

      <main className="relative z-10" style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "hsl(var(--primary)/0.6)", marginBottom: 12, fontFamily: "'Orbitron',sans-serif" }}>FINANCE TOOL</p>
          <h1 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 12 }}>Budget Maker</h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, maxWidth: 440, margin: "0 auto" }}>
            Plan your monthly budget. 🔒 rows are fixed base categories — only amounts are editable.
          </p>
        </div>

        {/* ── SECTION 1: Income ────────────────────────────────────────────── */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>SECTION 01</div>
              <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: "#4ade80" }}>Income</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>TOTAL MONTHLY</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 800, color: "#4ade80" }}>{fmt(totalIncome)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 8, paddingRight: 46 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Orbitron',sans-serif", flex: 1 }}>SOURCE</span>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Orbitron',sans-serif", width: 130, textAlign: "right", flexShrink: 0 }}>MONTHLY (€)</span>
          </div>
          {income.map((r) => (
            <AnimRow key={r.id} visible={rowVis[r.id] ?? true}>
              <input type="text" placeholder="e.g. Salary, Freelance…" value={r.label}
                onChange={(e) => setIncome((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))}
                style={{ ...IS, flex: 1 }} onFocus={fb} onBlur={bb} />
              <input type="number" placeholder="0.00" value={r.amount}
                onChange={(e) => setIncome((p) => p.map((x) => x.id === r.id ? { ...x, amount: e.target.value } : x))}
                style={amtIS} onFocus={fb} onBlur={bb} />
              <button onClick={() => removeIncome(r.id)} style={delBtnS}>✕</button>
            </AnimRow>
          ))}
          <button onClick={addIncome}
            style={{ marginTop: 8, background: "none", border: "1px dashed rgba(74,222,128,0.25)", borderRadius: 8, padding: "9px 18px", color: "#4ade80", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer", width: "100%" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.05)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; }}>
            + ADD INCOME SOURCE
          </button>
        </div>

        {/* ── SECTION 2: Expenses ──────────────────────────────────────────── */}
        <div style={sectionS}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>SECTION 02</div>
              <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: "#f87171" }}>Expenses</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>TOTAL BUDGETED</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 800, color: "#f87171" }}>{fmt(totalExpenses)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 8, paddingRight: 46 }}>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Orbitron',sans-serif", flex: 1 }}>CATEGORY</span>
            <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Orbitron',sans-serif", width: 130, textAlign: "right", flexShrink: 0 }}>MONTHLY (€)</span>
          </div>

          <GroupDivider label="FIXED MONTHLY" />
          {fixedMonthly.map(renderRow)}

          <GroupDivider label="FOOD & DRINK" />
          {foodDrink.map(renderRow)}

          <GroupDivider label="TRANSPORT" />
          {transport.map(renderRow)}

          {/* Subscriptions sub-section */}
          <GroupDivider label="SUBSCRIPTIONS" />
          <div style={{ background: "rgba(0,229,255,0.025)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: subscriptions.length > 0 ? 12 : 6 }}>
              <span style={{ fontSize: 11, color: "#475569" }}>
                Named subscriptions — total maps to <span style={{ color: "#00e5ff" }}>Subscriptions</span> in CSV comparison
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#00e5ff", fontFamily: "'Orbitron',sans-serif" }}>{fmt(totalSubscriptions)}</span>
            </div>
            {subscriptions.map((r) => (
              <AnimRow key={r.id} visible={rowVis[r.id] ?? true}>
                <input type="text" placeholder="e.g. Netflix, Spotify…" value={r.label}
                  onChange={(e) => setSubscriptions((p) => p.map((x) => x.id === r.id ? { ...x, label: e.target.value } : x))}
                  style={{ ...IS, flex: 1 }} onFocus={fb} onBlur={bb} />
                <input type="number" placeholder="0.00" value={r.amount}
                  onChange={(e) => setSubscriptions((p) => p.map((x) => x.id === r.id ? { ...x, amount: e.target.value } : x))}
                  style={{ ...amtIS, color: parseAmt(r.amount) > 0 ? "#00e5ff" : "#475569" }} onFocus={fb} onBlur={bb} />
                <button onClick={() => removeSubscription(r.id)} style={delBtnS}>✕</button>
              </AnimRow>
            ))}
            <button onClick={addSubscription}
              style={{ marginTop: 4, background: "none", border: "1px dashed rgba(0,229,255,0.2)", borderRadius: 6, padding: "7px 14px", color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.12em", cursor: "pointer" }}>
              + ADD SUBSCRIPTION
            </button>
          </div>

          <GroupDivider label="SAVINGS & FINANCE" />
          {savingsFin.map(renderRow)}

          <GroupDivider label="LIFESTYLE" />
          {lifestyle.map(renderRow)}

          {customRows.length > 0 && (
            <>
              <GroupDivider label="CUSTOM" />
              {customRows.map(renderRow)}
            </>
          )}

          <button onClick={addExpense}
            style={{ marginTop: 12, background: "none", border: "1px dashed rgba(248,113,113,0.25)", borderRadius: 8, padding: "9px 18px", color: "#f87171", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer", width: "100%" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.05)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)"; }}>
            + ADD CUSTOM CATEGORY
          </button>
        </div>

        {/* ── SECTION 3: Summary ───────────────────────────────────────────── */}
        <div style={{ ...sectionS, borderColor: remaining >= 0 ? "rgba(0,229,255,0.15)" : "rgba(251,146,60,0.2)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 20 }}>SECTION 03 — SUMMARY</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "TOTAL INCOME",   value: fmt(totalIncome),   color: "#4ade80" },
              { label: "TOTAL EXPENSES", value: fmt(totalExpenses), color: "#f87171" },
              { label: "REMAINING",      value: fmt(remaining),     color: remaining >= 0 ? "#00e5ff" : "#fb923c" },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Orbitron',sans-serif" }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#475569", fontFamily: "'Orbitron',sans-serif" }}>BUDGET ALLOCATION</span>
              <span style={{ fontSize: 10, color: allocPct > 100 ? "#fb923c" : "#64748b" }}>{allocPct.toFixed(1)}% of income</span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(allocPct, 100)}%`, background: allocPct > 100 ? "#fb923c" : allocPct > 85 ? "#fbbf24" : "linear-gradient(90deg,#00e5ff,#4ade80)", borderRadius: 4, transition: "width 0.5s, background 0.4s" }} />
            </div>
          </div>
          {remaining < 0 && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.2)", borderRadius: 8, fontSize: 12, color: "#fb923c" }}>
              ⚠ You are over budget by <strong>{fmt(Math.abs(remaining))}</strong>. Consider reducing some categories.
            </div>
          )}
          {remaining > 0 && totalIncome > 0 && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.15)", borderRadius: 8, fontSize: 12, color: "#00e5ff" }}>
              ✓ {fmt(remaining)} unallocated — consider adding it to Savings or Investments.
            </div>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {saveMsg && <span style={{ fontSize: 11, color: "#00e5ff", alignSelf: "center", letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif" }}>{saveMsg}</span>}
          <button onClick={() => setShowCompare(true)}
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, padding: "11px 24px", color: "#fbbf24", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(251,191,36,0.08)")}>
            ⚖️ COMPARE WITH CSV
          </button>
          <button onClick={saveBudget}
            style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 8, padding: "11px 24px", color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,229,255,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,229,255,0.08)")}>
            💾 SAVE BUDGET
          </button>
          <button onClick={resetBudget}
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "11px 24px", color: "#f87171", fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(248,113,113,0.06)")}>
            ↺ RESET
          </button>
        </div>
      </main>

      <Footer />
      {showCompare && <CompareModal rows={buildRows()} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
