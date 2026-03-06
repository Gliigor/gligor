import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

// ─── Types ────────────────────────────────────────────────────────────────────
interface IncomeRow {
  id: string;
  label: string;
  amount: string;
}

interface ExpenseRow {
  id: string;
  label: string;
  amount: string;
}

interface SavedBudget {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  savedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "budget_maker_v1";

const DEFAULT_EXPENSES: ExpenseRow[] = [
  { id: "e1",  label: "Housing (rent/mortgage)", amount: "" },
  { id: "e2",  label: "Utilities",               amount: "" },
  { id: "e3",  label: "Groceries",               amount: "" },
  { id: "e4",  label: "Transport",               amount: "" },
  { id: "e5",  label: "Dining Out",              amount: "" },
  { id: "e6",  label: "Health & Fitness",        amount: "" },
  { id: "e7",  label: "Entertainment",           amount: "" },
  { id: "e8",  label: "Clothing",                amount: "" },
  { id: "e9",  label: "Personal Care",           amount: "" },
  { id: "e10", label: "Subscriptions",           amount: "" },
  { id: "e11", label: "Savings",                 amount: "" },
  { id: "e12", label: "Investments",             amount: "" },
  { id: "e13", label: "Education",               amount: "" },
  { id: "e14", label: "Travel",                  amount: "" },
  { id: "e15", label: "Other",                   amount: "" },
];

const DEFAULT_INCOME: IncomeRow[] = [
  { id: "i1", label: "Salary", amount: "" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const parseAmt = (s: string) => {
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.35)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
  padding: "9px 13px",
  color: "hsl(var(--foreground))",
  fontFamily: "'Exo 2', sans-serif",
  fontSize: 13,
  outline: "none",
  transition: "border-color 0.2s",
  width: "100%",
};

const labelInputStyle: React.CSSProperties = {
  ...inputStyle,
  flex: 1,
};

const amountInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: 130,
  textAlign: "right",
  flexShrink: 0,
};

const deleteBtnStyle: React.CSSProperties = {
  background: "rgba(248,113,113,0.08)",
  border: "1px solid rgba(248,113,113,0.15)",
  borderRadius: 6,
  padding: "8px 12px",
  color: "#f87171",
  fontSize: 13,
  cursor: "pointer",
  transition: "all 0.2s",
  flexShrink: 0,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 14,
  padding: "28px 32px",
  background: "rgba(255,255,255,0.015)",
  backdropFilter: "blur(8px)",
  marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.2em",
  color: "#475569",
  fontFamily: "'Orbitron', sans-serif",
  display: "block",
  marginBottom: 6,
};

// ─── Row Animation Wrapper ────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BudgetMaker() {
  const [income,   setIncome]   = useState<IncomeRow[]>(DEFAULT_INCOME);
  const [expenses, setExpenses] = useState<ExpenseRow[]>(DEFAULT_EXPENSES);
  const [savedAt,  setSavedAt]  = useState<string | null>(null);
  const [saveMsg,  setSaveMsg]  = useState("");
  const [rowVis,   setRowVis]   = useState<Record<string, boolean>>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data: SavedBudget = JSON.parse(raw);
        setIncome(data.income);
        setExpenses(data.expenses);
        setSavedAt(data.savedAt);
      }
    } catch {}
  }, []);

  // Animate rows in on mount
  useEffect(() => {
    const ids = [...income.map((r) => r.id), ...expenses.map((r) => r.id)];
    const vis: Record<string, boolean> = {};
    ids.forEach((id) => (vis[id] = true));
    setRowVis(vis);
  }, []);

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalIncome   = income.reduce((s, r) => s + parseAmt(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + parseAmt(r.amount), 0);
  const remaining     = totalIncome - totalExpenses;
  const allocatedPct  = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0;

  // ── Income handlers ───────────────────────────────────────────────────────
  const addIncome = () => {
    const id = uid();
    setIncome((prev) => [...prev, { id, label: "", amount: "" }]);
    setTimeout(() => setRowVis((v) => ({ ...v, [id]: true })), 10);
  };

  const updateIncome = (id: string, field: "label" | "amount", val: string) =>
    setIncome((prev) => prev.map((r) => r.id === id ? { ...r, [field]: val } : r));

  const removeIncome = (id: string) => {
    setRowVis((v) => ({ ...v, [id]: false }));
    setTimeout(() => setIncome((prev) => prev.filter((r) => r.id !== id)), 260);
  };

  // ── Expense handlers ──────────────────────────────────────────────────────
  const addExpense = () => {
    const id = uid();
    setExpenses((prev) => [...prev, { id, label: "", amount: "" }]);
    setTimeout(() => setRowVis((v) => ({ ...v, [id]: true })), 10);
  };

  const updateExpense = (id: string, field: "label" | "amount", val: string) =>
    setExpenses((prev) => prev.map((r) => r.id === id ? { ...r, [field]: val } : r));

  const removeExpense = (id: string) => {
    setRowVis((v) => ({ ...v, [id]: false }));
    setTimeout(() => setExpenses((prev) => prev.filter((r) => r.id !== id)), 260);
  };

  // ── Save / Reset ──────────────────────────────────────────────────────────
  const saveBudget = useCallback(() => {
    try {
      const now = new Date().toLocaleString("nl-NL");
      const data: SavedBudget = { income, expenses, savedAt: now };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSavedAt(now);
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {}
  }, [income, expenses]);

  const resetBudget = () => {
    if (!window.confirm("Reset everything? This cannot be undone.")) return;
    setIncome(DEFAULT_INCOME);
    setExpenses(DEFAULT_EXPENSES);
    setSavedAt(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  };

  const focusStyle = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "rgba(0,229,255,0.4)");
  const blurStyle = (e: React.FocusEvent<HTMLInputElement>) =>
    (e.target.style.borderColor = "rgba(255,255,255,0.07)");

  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2', sans-serif" }}>
      <ConstellationBackground />
      <Header />

      {/* ── Sticky Summary Bar ─────────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(5,8,18,0.92)",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(0,229,255,0.1)",
        padding: "12px 24px",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Numbers row */}
          <div style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron', sans-serif" }}>INCOME</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", fontFamily: "'Orbitron', sans-serif" }}>{fmt(totalIncome)}</span>
            </div>
            <div style={{ color: "#1e293b", fontSize: 16 }}>−</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron', sans-serif" }}>BUDGETED</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f87171", fontFamily: "'Orbitron', sans-serif" }}>{fmt(totalExpenses)}</span>
            </div>
            <div style={{ color: "#1e293b", fontSize: 16 }}>=</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron', sans-serif" }}>REMAINING</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: remaining >= 0 ? "#00e5ff" : "#fb923c", fontFamily: "'Orbitron', sans-serif", transition: "color 0.3s" }}>
                {fmt(remaining)}
              </span>
            </div>
            {savedAt && (
              <div style={{ marginLeft: "auto", fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>
                SAVED {savedAt}
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${allocatedPct}%`,
              background: allocatedPct > 95 ? "#fb923c" : allocatedPct > 80 ? "#fbbf24" : "#00e5ff",
              borderRadius: 2,
              transition: "width 0.4s ease, background 0.4s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em" }}>0%</span>
            <span style={{ fontSize: 9, color: allocatedPct > 95 ? "#fb923c" : "#334155", letterSpacing: "0.1em", transition: "color 0.3s" }}>
              {allocatedPct.toFixed(0)}% ALLOCATED
            </span>
            <span style={{ fontSize: 9, color: "#334155", letterSpacing: "0.1em" }}>100%</span>
          </div>
        </div>
      </div>

      <main className="relative z-10" style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Page title */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "hsl(var(--primary)/0.6)", marginBottom: 12, fontFamily: "'Orbitron', sans-serif" }}>FINANCE TOOL</p>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 12, letterSpacing: "-0.01em" }}>
            Budget Maker
          </h1>
          <p style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, maxWidth: 420, margin: "0 auto" }}>
            Plan your monthly budget. Add income sources and allocate spending across categories.
          </p>
        </div>

        {/* ── Section 1: Income ──────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron', sans-serif", marginBottom: 4 }}>SECTION 01</div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 700, color: "#4ade80" }}>Income</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>TOTAL MONTHLY</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 800, color: "#4ade80", transition: "all 0.2s" }}>{fmt(totalIncome)}</div>
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", gap: 10, marginBottom: 8, paddingRight: 46 }}>
            <span style={{ ...labelStyle, flex: 1, marginBottom: 0 }}>SOURCE</span>
            <span style={{ ...labelStyle, width: 130, textAlign: "right", marginBottom: 0, flexShrink: 0 }}>MONTHLY (€)</span>
          </div>

          {income.map((row) => (
            <AnimRow key={row.id} visible={rowVis[row.id] ?? true}>
              <input
                type="text"
                placeholder="e.g. Salary, Freelance…"
                value={row.label}
                onChange={(e) => updateIncome(row.id, "label", e.target.value)}
                style={labelInputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <input
                type="number"
                placeholder="0.00"
                value={row.amount}
                onChange={(e) => updateIncome(row.id, "amount", e.target.value)}
                style={amountInputStyle}
                onFocus={focusStyle}
                onBlur={blurStyle}
              />
              <button onClick={() => removeIncome(row.id)} style={deleteBtnStyle} title="Remove">✕</button>
            </AnimRow>
          ))}

          <button
            onClick={addIncome}
            style={{ marginTop: 8, background: "none", border: "1px dashed rgba(74,222,128,0.25)", borderRadius: 8, padding: "9px 18px", color: "#4ade80", fontFamily: "'Orbitron', sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer", transition: "all 0.2s", width: "100%" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(74,222,128,0.05)"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(74,222,128,0.25)"; }}
          >
            + ADD INCOME SOURCE
          </button>
        </div>

        {/* ── Section 2: Expenses ────────────────────────────────────────── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron', sans-serif", marginBottom: 4 }}>SECTION 02</div>
              <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 18, fontWeight: 700, color: "#f87171" }}>Expenses</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 2 }}>TOTAL BUDGETED</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 22, fontWeight: 800, color: "#f87171", transition: "all 0.2s" }}>{fmt(totalExpenses)}</div>
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: "flex", gap: 10, marginBottom: 8, paddingRight: 46 }}>
            <span style={{ ...labelStyle, flex: 1, marginBottom: 0 }}>CATEGORY</span>
            <span style={{ ...labelStyle, width: 130, textAlign: "right", marginBottom: 0, flexShrink: 0 }}>MONTHLY (€)</span>
          </div>

          {expenses.map((row) => {
            const amt = parseAmt(row.amount);
            const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
            return (
              <AnimRow key={row.id} visible={rowVis[row.id] ?? true}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Category name…"
                    value={row.label}
                    onChange={(e) => updateExpense(row.id, "label", e.target.value)}
                    style={{ ...labelInputStyle, paddingRight: amt > 0 ? 60 : 13 }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  {amt > 0 && (
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#334155", letterSpacing: "0.05em", pointerEvents: "none" }}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  value={row.amount}
                  onChange={(e) => updateExpense(row.id, "amount", e.target.value)}
                  style={{ ...amountInputStyle, color: amt > 0 ? "#f87171" : "hsl(var(--muted-foreground))" }}
                  onFocus={focusStyle}
                  onBlur={blurStyle}
                />
                <button onClick={() => removeExpense(row.id)} style={deleteBtnStyle} title="Remove">✕</button>
              </AnimRow>
            );
          })}

          <button
            onClick={addExpense}
            style={{ marginTop: 8, background: "none", border: "1px dashed rgba(248,113,113,0.25)", borderRadius: 8, padding: "9px 18px", color: "#f87171", fontFamily: "'Orbitron', sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer", transition: "all 0.2s", width: "100%" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.05)"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.5)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.borderColor = "rgba(248,113,113,0.25)"; }}
          >
            + ADD CATEGORY
          </button>
        </div>

        {/* ── Section 3: Summary ─────────────────────────────────────────── */}
        <div style={{ ...sectionStyle, borderColor: remaining >= 0 ? "rgba(0,229,255,0.15)" : "rgba(251,146,60,0.2)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron', sans-serif", marginBottom: 20 }}>SECTION 03 — SUMMARY</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            {[
              { label: "TOTAL INCOME",   value: fmt(totalIncome),   color: "#4ade80" },
              { label: "TOTAL EXPENSES", value: fmt(totalExpenses), color: "#f87171" },
              { label: "REMAINING",      value: fmt(remaining),     color: remaining >= 0 ? "#00e5ff" : "#fb923c" },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(0,0,0,0.2)", borderRadius: 10, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.18em", color: "#475569", fontFamily: "'Orbitron', sans-serif", marginBottom: 8 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'Orbitron', sans-serif", transition: "color 0.3s" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Allocation bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron', sans-serif" }}>BUDGET ALLOCATION</span>
              <span style={{ fontSize: 10, color: allocatedPct > 100 ? "#fb923c" : "#64748b", letterSpacing: "0.08em" }}>
                {allocatedPct.toFixed(1)}% of income
              </span>
            </div>
            <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min(allocatedPct, 100)}%`,
                background: allocatedPct > 100 ? "#fb923c" : allocatedPct > 85 ? "#fbbf24" : "linear-gradient(90deg, #00e5ff, #4ade80)",
                borderRadius: 4,
                transition: "width 0.5s ease, background 0.4s",
              }} />
            </div>
            {/* Category breakdown mini-bars */}
            {totalExpenses > 0 && (
              <div style={{ display: "flex", height: 3, marginTop: 4, borderRadius: 2, overflow: "hidden", gap: 1 }}>
                {expenses.filter((r) => parseAmt(r.amount) > 0).map((r) => {
                  const pct = (parseAmt(r.amount) / totalExpenses) * 100;
                  const colors = ["#60a5fa","#4ade80","#f472b6","#fb923c","#a78bfa","#34d399","#fbbf24","#f87171","#94a3b8","#00e5ff","#e879f9","#22d3ee","#86efac","#fca5a5","#c4b5fd"];
                  const idx = expenses.indexOf(r) % colors.length;
                  return <div key={r.id} style={{ flex: `0 0 ${pct}%`, background: colors[idx] }} title={r.label} />;
                })}
              </div>
            )}
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

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
          {saveMsg && <span style={{ fontSize: 11, color: "#00e5ff", alignSelf: "center", letterSpacing: "0.1em", fontFamily: "'Orbitron', sans-serif" }}>{saveMsg}</span>}
          <button
            onClick={saveBudget}
            style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 8, padding: "11px 24px", color: "#00e5ff", fontFamily: "'Orbitron', sans-serif", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,229,255,0.15)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(0,229,255,0.08)"}
          >
            💾 SAVE BUDGET
          </button>
          <button
            onClick={resetBudget}
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 8, padding: "11px 24px", color: "#f87171", fontFamily: "'Orbitron', sans-serif", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(248,113,113,0.12)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(248,113,113,0.06)"}
          >
            ↺ RESET
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
