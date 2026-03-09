import { useState, useCallback, useRef, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";
import { loadCategories, categoryColor, autoClassify, CLASSIFICATION_RULES } from "./sharedCategories";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string; date: string; name: string; description: string;
  amount: number; category: string; confidence: "high" | "low" | "rule";
  manual?: boolean; internalSuggested?: boolean;
}
interface Subscription {
  name: string; amount: number; frequency: string;
  monthlyEstimate: number; occurrences: number;
}
interface BudgetComparison {
  category: string; budgeted: number; actual: number;
  diff: number; pct: number;
  status: "under" | "over" | "exact" | "unbudgeted" | "nodata";
}
// Saved rule: "whenever name X appears, use category Y"
interface CategoryRule { name: string; category: string; }

const CSV_KEY        = "budget_dashboard_v1";
const BUDGET_KEY     = "budget_maker_v1";
const RULES_KEY      = "category_rules_v1";

/** Transactions with this category are excluded from all financial totals. */
const INTERNAL = "Internal";

// ─── Smart classifier ─────────────────────────────────────────────────────────
// Returns { category, confidence } instead of just a string.
// "high"  = keyword matched
// "low"   = fuzzy / partial guess
// "rule"  = user-saved rule
function smartClassify(
  name: string,
  desc: string,
  rules: CategoryRule[],
): { category: string; confidence: "high" | "low" | "rule" } {
  const nameLower = name.toLowerCase().trim();

  // 1. Check saved rules first (user's explicit overrides)
  const rule = rules.find((r) => r.name.toLowerCase() === nameLower);
  if (rule) return { category: rule.category, confidence: "rule" };

  // 2. Try exact keyword match from shared rules
  const exact = autoClassify(name, desc);
  if (exact !== "Other") return { category: exact, confidence: "high" };

  // 3. Fuzzy: check each category's keywords for partial token overlap
  const hay = `${name} ${desc}`.toLowerCase();
  const tokens = hay.split(/[\s\-_/.,]+/).filter((t) => t.length > 2);
  let bestCat = "Other", bestScore = 0;
  for (const rule of CLASSIFICATION_RULES) {
    for (const kw of rule.keywords) {
      const score = tokens.filter((t) => kw.includes(t) || t.includes(kw)).length;
      if (score > bestScore) { bestScore = score; bestCat = rule.category; }
    }
  }
  if (bestScore > 0) return { category: bestCat, confidence: "low" };

  // 4. Amount-based fallback hints
  // No match — truly Other
  return { category: "Other", confidence: "high" };
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function parseCSV(text: string, rules: CategoryRule[]): Transaction[] {
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
    const n = name?.trim() ?? "";
    const d = description?.trim() ?? "";
    const { category, confidence } = smartClassify(n, d, rules);
    return { id: `csv-${i}`, date: date?.trim() ?? "", name: n, description: d, amount, category, confidence };
  }).filter((t) => !isNaN(t.amount));
}

// ─── Subscription Detector ────────────────────────────────────────────────────
function detectSubscriptions(txns: Transaction[]): Subscription[] {
  const expenses = txns.filter((t) => t.amount < 0);
  const grouped: Record<string, Transaction[]> = {};
  for (const t of expenses) {
    const key = t.name.toLowerCase().trim();
    grouped[key] = grouped[key] ?? [];
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
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i].getTime() - dates[i - 1].getTime()) / 86400000);
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

// ─── Internal Transfer Pair Detection ────────────────────────────────────────
// Returns IDs of transactions that look like mirrored internal transfers:
// same absolute amount, opposite sign, within 3 days of each other.
function detectInternalPairs(txns: Transaction[]): Set<string> {
  const suggested = new Set<string>();
  // Only consider non-already-internal transactions
  const candidates = txns.filter((t) => t.category !== INTERNAL);
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      // Must be opposite signs, same absolute amount (within €0.01)
      if (Math.sign(a.amount) === Math.sign(b.amount)) continue;
      if (Math.abs(Math.abs(a.amount) - Math.abs(b.amount)) > 0.01) continue;
      // Must be within 3 days
      const da = new Date(a.date).getTime(), db = new Date(b.date).getTime();
      if (Math.abs(da - db) > 3 * 86400000) continue;
      suggested.add(a.id);
      suggested.add(b.id);
    }
  }
  return suggested;
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const DROP: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid rgba(148,163,184,0.3)",
  borderRadius: 7,
  padding: "5px 10px",
  color: "#e2e8f0",
  fontFamily: "'Exo 2',sans-serif",
  fontSize: 12,
  cursor: "pointer",
  outline: "none",
  appearance: "auto",
  minWidth: 140,
};

// ─── Confidence badge ─────────────────────────────────────────────────────────
const ConfBadge = ({ c }: { c: Transaction["confidence"] }) => {
  if (c === "rule") return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(0,229,255,0.12)", color: "#00e5ff", letterSpacing: "0.08em" }}>RULE</span>
  );
  if (c === "low") return (
    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(251,191,36,0.12)", color: "#fbbf24", letterSpacing: "0.08em" }}>GUESS</span>
  );
  return null; // high confidence — no badge needed
};

// ─── Bulk Apply Dialog ────────────────────────────────────────────────────────
const BulkDialog = ({
  txn, dupCount, categories, onApplyOne, onApplyAll, onClose,
}: {
  txn: Transaction; dupCount: number; categories: string[];
  onApplyOne: (cat: string) => void;
  onApplyAll: (cat: string) => void;
  onClose: () => void;
}) => {
  const [selected, setSelected] = useState(txn.category);
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 10); }, []);
  const close = () => { setVis(false); setTimeout(onClose, 250); };

  return (
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 300, background: `rgba(0,0,0,${vis ? 0.75 : 0})`, transition: "background 0.25s", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(460px,96vw)", background: "#080e1a", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 14, padding: "28px 28px 24px", transform: vis ? "scale(1)" : "scale(0.93)", opacity: vis ? 1 : 0, transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s" }}>
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", fontFamily: "'Orbitron',sans-serif", marginBottom: 6 }}>CATEGORIZE</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>{txn.name}</div>
        {txn.description && <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>{txn.description}</div>}

        <label style={{ fontSize: 10, letterSpacing: "0.15em", color: "#475569", fontFamily: "'Orbitron',sans-serif", display: "block", marginBottom: 8 }}>SELECT CATEGORY</label>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ ...DROP, width: "100%", padding: "10px 14px", fontSize: 13, marginBottom: 20 }}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {dupCount > 1 && (
          <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fbbf24" }}>
            ⚡ <strong>{dupCount} transactions</strong> share the name <em>"{txn.name}"</em>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => { onApplyOne(selected); close(); }}
            style={{ flex: 1, padding: "10px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#94a3b8", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.12em", cursor: "pointer" }}>
            THIS ONE ONLY
          </button>
          {dupCount > 1 && (
            <button onClick={() => { onApplyAll(selected); close(); }}
              style={{ flex: 2, padding: "10px 16px", background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 8, color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.12em", cursor: "pointer" }}>
              ALL {dupCount} × "{txn.name}" + SAVE RULE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Drill-Down Panel ─────────────────────────────────────────────────────────
const DrillDownPanel = ({
  category, transactions, categories, onClose, onRelabel,
}: {
  category: string; transactions: Transaction[]; categories: string[];
  onClose: () => void;
  onRelabel: (id: string, cat: string) => void;
}) => {
  const total = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 10); }, []);
  const handleClose = () => { setVis(false); setTimeout(onClose, 300); };

  return (
    <div onClick={handleClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: `rgba(0,0,0,${vis ? 0.7 : 0})`, transition: "background 0.3s", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(480px,95vw)", height: "100vh", background: "#080e1a", borderLeft: "1px solid rgba(0,229,255,0.15)", transform: vis ? "translateX(0)" : "translateX(100%)", transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
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
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <ConfBadge c={t.confidence} />
                </div>
                {t.description && <div style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.description}</div>}
                <div style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{t.date}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.amount >= 0 ? "#4ade80" : "#f87171", marginBottom: 6 }}>{fmt(t.amount)}</div>
                <select value={t.category} onChange={(e) => onRelabel(t.id, e.target.value)} style={DROP}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
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
  const [vis, setVis] = useState(false);
  useEffect(() => { setTimeout(() => setVis(true), 10); }, []);
  const close = () => { setVis(false); setTimeout(onClose, 280); };

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
    <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 200, background: `rgba(0,0,0,${vis ? 0.8 : 0})`, transition: "background 0.28s", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(800px,98vw)", maxHeight: "90vh", overflowY: "auto", background: "#080e1a", border: "1px solid rgba(0,229,255,0.18)", borderRadius: 14, padding: "28px 32px", transform: vis ? "scale(1)" : "scale(0.94)", opacity: vis ? 1 : 0, transition: "transform 0.28s cubic-bezier(0.34,1.56,0.64,1),opacity 0.28s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", fontFamily: "'Orbitron',sans-serif", marginBottom: 6 }}>ANALYSIS</div>
            <h2 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 20, fontWeight: 800, color: "#e2e8f0" }}>Budget vs Actual</h2>
          </div>
          <button onClick={close} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 13px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {["CATEGORY","BUDGETED","ACTUAL SPENT","DIFFERENCE","USAGE","STATUS"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron',sans-serif", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const badge  = statusBadge(r.status);
                const barPct = r.budgeted > 0 ? Math.min((r.actual / r.budgeted) * 100, 150) : 0;
                const barClr = barPct > 100 ? "#f87171" : barPct > 85 ? "#fbbf24" : "#4ade80";
                return (
                  <tr key={r.category} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "11px 10px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: categoryColor(r.category), display: "inline-block" }} />
                        <span style={{ fontSize: 12, color: "#e2e8f0" }}>{r.category}</span>
                      </span>
                    </td>
                    <td style={{ padding: "11px 10px", fontSize: 12, color: "#60a5fa" }}>{r.budgeted > 0 ? fmt(r.budgeted) : <span style={{ color: "#334155" }}>—</span>}</td>
                    <td style={{ padding: "11px 10px", fontSize: 12, color: r.actual > 0 ? "#f87171" : "#475569" }}>{r.actual > 0 ? fmt(r.actual) : <span style={{ color: "#334155" }}>€0</span>}</td>
                    <td style={{ padding: "11px 10px", fontSize: 12, fontWeight: 600, color: r.diff >= 0 ? "#4ade80" : "#f87171" }}>
                      {r.status === "unbudgeted" || r.status === "nodata" ? "—" : (r.diff >= 0 ? "+" : "") + fmt(r.diff)}
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
                      <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: badge.bg, color: badge.color, whiteSpace: "nowrap" }}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Donut Chart Row ──────────────────────────────────────────────────────────
const DonutRow = ({ label, total, color, pieData, onSliceClick }: {
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
      <div style={{ fontSize: 10, color: "#334155" }}>{pieData.length} CATEGORIES</div>
    </div>
    <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
      <div style={{ flexShrink: 0 }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2} dataKey="value" onClick={(d) => onSliceClick(d.name)} style={{ cursor: "pointer" }}>
              {pieData.map((e) => <Cell key={e.name} fill={categoryColor(e.name)} />)}
            </Pie>
            <Tooltip content={({ active, payload }: any) => active && payload?.length ? (
              <div style={{ background: "rgba(0,0,0,0.92)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 8, padding: "10px 14px", fontFamily: "'Exo 2',sans-serif", fontSize: 12 }}>
                <div style={{ color: "#94a3b8", marginBottom: 4 }}>{payload[0].name}</div>
                <div style={{ color: "#00e5ff", fontWeight: 600 }}>{fmt(payload[0].value)}</div>
              </div>
            ) : null} />
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
        {pieData.length > 6 && <div style={{ fontSize: 10, color: "#334155", paddingLeft: 15 }}>+{pieData.length - 6} more</div>}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CsvDashboard() {
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [categories,    setCategories]    = useState<string[]>(() => loadCategories());
  const [rules,         setRules]         = useState<CategoryRule[]>(() => {
    try { return JSON.parse(localStorage.getItem(RULES_KEY) ?? "[]"); } catch { return []; }
  });
  const [dragging,      setDragging]      = useState(false);
  const [activeTab,     setActiveTab]     = useState<"overview"|"review"|"internal"|"raw"|"subscriptions"|"rules"|"add">("overview");
  const [filter,        setFilter]        = useState("All");
  const [editingId,     setEditingId]     = useState<string|null>(null);
  const [drillCategory, setDrillCategory] = useState<string|null>(null);
  const [drillIsIncome, setDrillIsIncome] = useState(false);
  const [bulkTxn,       setBulkTxn]       = useState<Transaction|null>(null);
  const [hasSaved,      setHasSaved]      = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");
  const [showCompare,   setShowCompare]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date:"", name:"", description:"", amount:"", category: categories[0] });

  useEffect(() => {
    const onStorage = () => setCategories(loadCategories());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    try { if (localStorage.getItem(CSV_KEY)) setHasSaved(true); } catch {}
  }, []);

  useEffect(() => {
    if (transactions.length > 0) {
      try { localStorage.setItem(CSV_KEY, JSON.stringify(transactions)); } catch {}
    }
  }, [transactions]);

  // ── Rules persistence ───────────────────────────────────────────────────────
  const saveRules = (r: CategoryRule[]) => {
    setRules(r);
    try { localStorage.setItem(RULES_KEY, JSON.stringify(r)); } catch {}
  };

  const addRule = (name: string, category: string) => {
    const next = rules.filter((r) => r.name.toLowerCase() !== name.toLowerCase());
    next.push({ name: name.trim(), category });
    saveRules(next);
  };

  const deleteRule = (name: string) => saveRules(rules.filter((r) => r.name !== name));

  // ── File loading ────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCSV(e.target?.result as string, rules);
      setTransactions(parsed);
      // If there are low-confidence guesses, go straight to review tab
      const hasLow = parsed.some((t) => t.confidence === "low" && t.amount < 0);
      setActiveTab(hasLow ? "review" : "overview");
    };
    reader.readAsText(file);
  // rules is stable on load — exhaustive-deps warning acceptable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const saveDashboard = () => {
    try {
      localStorage.setItem(CSV_KEY, JSON.stringify(transactions));
      setHasSaved(true); setSaveMsg("Saved!"); setTimeout(() => setSaveMsg(""), 2000);
    } catch {}
  };

  const restoreSession = () => {
    try {
      const saved = localStorage.getItem(CSV_KEY);
      if (saved) { setTransactions(JSON.parse(saved)); setActiveTab("overview"); }
    } catch {}
  };

  const clearSaved = () => {
    try { localStorage.removeItem(CSV_KEY); setHasSaved(false); } catch {}
  };

  // Mark all auto-detected internal pairs as Internal in one click
  const markAllSuggestedInternal = (ids: string[]) => {
    setTransactions((p) => p.map((t) =>
      ids.includes(t.id) ? { ...t, category: INTERNAL, confidence: "high" as const } : t
    ));
  };
  const updateOne = (id: string, cat: string) => {
    setTransactions((p) => p.map((t) => t.id === id ? { ...t, category: cat, confidence: "high" } : t));
    setEditingId(null);
  };

  // Apply category to a single transaction (from bulk dialog)
  const applyOne = (id: string, cat: string) => {
    setTransactions((p) => p.map((t) => t.id === id ? { ...t, category: cat, confidence: "high" } : t));
  };

  // Apply category to ALL transactions with the same name + save rule
  const applyAll = (name: string, cat: string) => {
    setTransactions((p) => p.map((t) =>
      t.name.toLowerCase() === name.toLowerCase()
        ? { ...t, category: cat, confidence: "rule" }
        : t
    ));
    addRule(name, cat);
  };

  const relabelTransaction = (id: string, cat: string) => {
    setTransactions((p) => p.map((t) => t.id === id ? { ...t, category: cat, confidence: "high" } : t));
  };

  // Open bulk dialog — counts how many share the same name
  const openBulk = (t: Transaction) => setBulkTxn(t);

  const addManual = () => {
    if (!form.date || !form.name || !form.amount) return;
    setTransactions((p) => [...p, {
      id: `manual-${Date.now()}`, date: form.date, name: form.name,
      description: form.description, amount: parseFloat(form.amount),
      category: form.category, confidence: "high", manual: true,
    }]);
    setForm({ date:"", name:"", description:"", amount:"", category: categories[0] });
    setActiveTab("raw");
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  // Internal transactions are excluded from all financial calculations
  const internalT = transactions.filter((t) => t.category === INTERNAL);
  const incomeT   = transactions.filter((t) => t.amount > 0 && t.category !== INTERNAL);
  const expenseT  = transactions.filter((t) => t.amount < 0 && t.category !== INTERNAL);
  const totalIn   = incomeT.reduce((s, t) => s + t.amount, 0);
  const totalOut  = expenseT.reduce((s, t) => s + Math.abs(t.amount), 0);
  const net       = totalIn - totalOut;

  const incomeByCategory:  Record<string,number> = {};
  const expenseByCategory: Record<string,number> = {};
  for (const t of incomeT)  incomeByCategory[t.category]  = (incomeByCategory[t.category]  ?? 0) + t.amount;
  for (const t of expenseT) expenseByCategory[t.category] = (expenseByCategory[t.category] ?? 0) + Math.abs(t.amount);

  // Pie data excludes Internal automatically (since it's not in incomeT/expenseT)
  const incomePieData  = Object.entries(incomeByCategory).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:parseFloat(value.toFixed(2))}));
  const expensePieData = Object.entries(expenseByCategory).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:parseFloat(value.toFixed(2))}));

  const filteredTxns  = filter === "All" ? transactions : transactions.filter((t) => t.category === filter);
  const subscriptions = detectSubscriptions(transactions.filter((t) => t.category !== INTERNAL));

  // Smart internal pair suggestions (transactions not yet marked Internal)
  const internalSuggestions = detectInternalPairs(transactions);
  const suggestedButNotLabeled = transactions.filter(
    (t) => internalSuggestions.has(t.id) && t.category !== INTERNAL
  );

  // Transactions needing review = low confidence expenses only (excluding Internal)
  const reviewTxns = transactions.filter((t) => t.confidence === "low" && t.amount < 0 && t.category !== INTERNAL);

  const drillTxns = drillCategory
    ? drillCategory === INTERNAL
      ? internalT
      : (drillIsIncome ? incomeT : expenseT).filter((t) => t.category === drillCategory)
    : [];

  const openDrill = (cat: string, isIncome: boolean) => { setDrillIsIncome(isIncome); setDrillCategory(cat); };

  // ── Budget comparison ─────────────────────────────────────────────────────────
  const buildComparisonRows = (): BudgetComparison[] => {
    const budgetMap: Record<string, number> = {};
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        for (const row of (saved.expenses ?? [])) {
          const amt = parseFloat(row.amount);
          if (!isNaN(amt) && amt > 0) budgetMap[row.label] = (budgetMap[row.label] ?? 0) + amt;
        }
        const subTotal = (saved.subscriptions ?? []).reduce((s: number, r: { amount: string }) => s + (parseFloat(r.amount) || 0), 0);
        if (subTotal > 0) budgetMap["Subscriptions"] = (budgetMap["Subscriptions"] ?? 0) + subTotal;
      }
    } catch {}
    const allCats = new Set([...Object.keys(budgetMap), ...Object.keys(expenseByCategory)]);
    const rows: BudgetComparison[] = [];
    for (const cat of allCats) {
      if (cat === "Income" || cat === INTERNAL) continue;  // exclude Internal from budget comparison
      const budgeted = budgetMap[cat] ?? 0;
      const actual   = expenseByCategory[cat] ?? 0;
      const diff     = budgeted - actual;
      const pct      = budgeted > 0 ? (actual / budgeted) * 100 : 0;
      let status: BudgetComparison["status"] = "nodata";
      if (budgeted === 0)             status = "unbudgeted";
      else if (actual === 0)          status = "nodata";
      else if (Math.abs(diff) < 0.01) status = "exact";
      else if (diff > 0)              status = "under";
      else                            status = "over";
      rows.push({ category: cat, budgeted, actual, diff, pct, status });
    }
    return rows.sort((a, b) => b.actual - a.actual);
  };

  const inputStyle: React.CSSProperties = { width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", color: "#e2e8f0", fontFamily: "'Exo 2',sans-serif", fontSize: 13, outline: "none" };

  const tabs = [
    { id: "overview"      as const, label: "OVERVIEW" },
    { id: "review"        as const, label: `REVIEW${reviewTxns.length ? ` (${reviewTxns.length})` : ""}`, alert: reviewTxns.length > 0 },
    { id: "internal"      as const, label: `INTERNAL${internalT.length ? ` (${internalT.length})` : ""}`, alert: suggestedButNotLabeled.length > 0 },
    { id: "raw"           as const, label: "RAW DATA" },
    { id: "subscriptions" as const, label: `SUBS${subscriptions.length ? ` (${subscriptions.length})` : ""}` },
    { id: "rules"         as const, label: `RULES${rules.length ? ` (${rules.length})` : ""}` },
    { id: "add"           as const, label: "+ ADD" },
  ];

  const dupCount = (name: string) => transactions.filter((t) => t.name.toLowerCase() === name.toLowerCase()).length;

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
              <button onClick={restoreSession} style={{ background: "rgba(0,229,255,0.1)", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 6, padding: "8px 16px", color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 10, cursor: "pointer" }}>RESTORE</button>
              <button onClick={clearSaved}     style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "8px 16px", color: "#f87171", fontFamily: "'Orbitron',sans-serif", fontSize: 10, cursor: "pointer" }}>CLEAR</button>
            </div>
          </div>
        )}

        {/* Drop Zone */}
        {transactions.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer mx-auto max-w-lg"
            style={{ border: `2px dashed ${dragging ? "hsl(var(--primary))" : "rgba(0,229,255,0.2)"}`, borderRadius: 12, padding: "64px 40px", textAlign: "center", background: dragging ? "rgba(0,229,255,0.03)" : "rgba(0,229,255,0.01)", transition: "all 0.3s" }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            <div style={{ fontSize: 36, marginBottom: 16 }}>📂</div>
            <div className="text-foreground font-semibold mb-2" style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 15, letterSpacing: "0.05em" }}>DROP YOUR BUNQ CSV</div>
            <div className="text-muted-foreground text-xs tracking-wider">or click to browse</div>
            {rules.length > 0 && (
              <div style={{ marginTop: 16, fontSize: 11, color: "#334155" }}>
                {rules.length} saved categorization rule{rules.length !== 1 ? "s" : ""} will be applied automatically
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Top action bar */}
            <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
              <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{transactions.length} transactions loaded</span>
              <div className="flex gap-3 flex-wrap">
                {saveMsg && <span style={{ fontSize: 11, color: "#00e5ff", alignSelf: "center", letterSpacing: "0.1em" }}>{saveMsg}</span>}
                <button onClick={() => setShowCompare(true)} style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "8px 14px", color: "#fbbf24", fontFamily: "'Orbitron',sans-serif", fontSize: 10, cursor: "pointer" }}>⚖️ COMPARE WITH BUDGET</button>
                <button onClick={saveDashboard} className="text-xs tracking-widest px-4 py-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all" style={{ fontFamily: "'Orbitron',sans-serif" }}>💾 SAVE</button>
                {hasSaved && <button onClick={clearSaved} className="text-xs tracking-widest px-4 py-2 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all" style={{ fontFamily: "'Orbitron',sans-serif" }}>CLEAR SAVED</button>}
                <button onClick={() => downloadCSV(transactions)} className="text-xs tracking-widest px-4 py-2 rounded border border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all" style={{ fontFamily: "'Orbitron',sans-serif" }}>↓ EXPORT</button>
                <button onClick={() => { setTransactions([]); setActiveTab("overview"); }} className="text-xs tracking-widest px-4 py-2 rounded border border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all" style={{ fontFamily: "'Orbitron',sans-serif" }}>↺ NEW FILE</button>
              </div>
            </div>

            {/* Stat Cards */}
            {/* Internal transfer suggestion banner */}
            {suggestedButNotLabeled.length > 0 && (
              <div style={{ background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, padding: "14px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "'Orbitron',sans-serif", letterSpacing: "0.1em", marginBottom: 3 }}>🔄 INTERNAL TRANSFER PAIRS DETECTED</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {suggestedButNotLabeled.length} transaction{suggestedButNotLabeled.length !== 1 ? "s" : ""} look like mirrored internal transfers (same amount, opposite direction, within 3 days). These inflate your income and expense totals.
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setActiveTab("internal")}
                    style={{ background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "7px 14px", color: "#94a3b8", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                    REVIEW
                  </button>
                  <button onClick={() => markAllSuggestedInternal(suggestedButNotLabeled.map((t) => t.id))}
                    style={{ background: "rgba(148,163,184,0.15)", border: "1px solid rgba(148,163,184,0.4)", borderRadius: 6, padding: "7px 14px", color: "#cbd5e1", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                    MARK ALL AS INTERNAL
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: "TOTAL INCOME",   value: fmt(totalIn),  color: "#4ade80" },
                { label: "TOTAL EXPENSES", value: fmt(totalOut), color: "#f87171" },
                { label: "NET BALANCE",    value: fmt(net),      color: net >= 0 ? "hsl(var(--primary))" : "#fb923c" },
              ].map((s) => (
                <div key={s.label} className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-3 uppercase">{s.label}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'Orbitron',sans-serif", color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {internalT.length > 0 && (
              <div style={{ fontSize: 11, color: "#475569", textAlign: "center", marginTop: -28, marginBottom: 24, letterSpacing: "0.05em" }}>
                ↳ {internalT.length} internal transfer{internalT.length !== 1 ? "s" : ""} ({fmt(internalT.reduce((s,t)=>s+Math.abs(t.amount),0))}) excluded from all totals
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border/40 mb-8 overflow-x-auto">
              {tabs.map((tab) => {
                const isInternal = tab.id === "internal";
                const alertColor = isInternal ? "#94a3b8" : "#fbbf24";
                const alertBorder = isInternal ? "rgba(148,163,184,0.4)" : "rgba(251,191,36,0.4)";
                return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  fontFamily: "'Orbitron',sans-serif",
                  color: activeTab === tab.id ? "hsl(var(--primary))" : tab.alert ? alertColor : "hsl(var(--muted-foreground))",
                  background: "none", border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid hsl(var(--primary))" : tab.alert ? `2px solid ${alertBorder}` : "2px solid transparent",
                  padding: "10px 16px", fontSize: 10, letterSpacing: "0.12em",
                  cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.2s",
                  position: "relative",
                }}>
                  {tab.label}
                  {tab.alert && <span style={{ position: "absolute", top: 6, right: 6, width: 5, height: 5, borderRadius: "50%", background: alertColor }} />}
                </button>
                );
              })}
            </div>

            {/* ── OVERVIEW ───────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <DonutRow label="ROW 1 — INCOME"   total={totalIn}  color="#4ade80" pieData={incomePieData}  onSliceClick={(cat) => openDrill(cat, true)} />
                <DonutRow label="ROW 2 — EXPENSES" total={totalOut} color="#f87171" pieData={expensePieData} onSliceClick={(cat) => openDrill(cat, false)} />
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">Full Category Breakdown — click to drill down</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Category","Transactions","Total","% of Expenses"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron',sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(expenseByCategory).sort((a,b) => b[1]-a[1]).map(([cat, total]) => {
                        const count = expenseT.filter((t) => t.category === cat).length;
                        const pct   = totalOut > 0 ? ((total / totalOut) * 100).toFixed(1) : "0";
                        return (
                          <tr key={cat} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }} className="hover:bg-white/[0.02] transition-colors" onClick={() => openDrill(cat, false)}>
                            <td style={{ padding: "10px 12px" }}><span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, background: categoryColor(cat)+"22", color: categoryColor(cat) }}>{cat}</span></td>
                            <td style={{ padding: "10px 12px", color: "#64748b", fontSize: 12 }}>{count}</td>
                            <td style={{ padding: "10px 12px", color: "#f87171", fontSize: 12 }}>{fmt(total)}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ height: 3, width: 80, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: categoryColor(cat), borderRadius: 2 }} />
                                </div>
                                <span style={{ color: "#64748b", fontSize: 11 }}>{pct}%</span>
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

            {/* ── REVIEW ─────────────────────────────────────────────────── */}
            {activeTab === "review" && (
              <div className="space-y-4">
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-1">Smart Review</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#e2e8f0", fontFamily: "'Orbitron',sans-serif" }}>
                        {reviewTxns.length} transactions need your eye
                      </div>
                    </div>
                    {reviewTxns.length === 0 && (
                      <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>✓ All categorized</span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", marginBottom: 24 }}>
                    These transactions couldn't be matched with confidence. The <span style={{ color: "#fbbf24" }}>GUESS</span> badge shows our best estimate — confirm or change. Click a row to categorize, or use "Apply to All" to bulk-apply by name.
                  </p>

                  {reviewTxns.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "#334155", fontSize: 13 }}>
                      🎉 Nothing left to review — all transactions are categorized.
                    </div>
                  ) : (
                    <>
                      {/* Group by name for visual clarity */}
                      {(() => {
                        const grouped: Record<string, Transaction[]> = {};
                        for (const t of reviewTxns) {
                          grouped[t.name] = grouped[t.name] ?? [];
                          grouped[t.name].push(t);
                        }
                        return Object.entries(grouped).map(([name, group]) => (
                          <div key={name} style={{ marginBottom: 16, border: "1px solid rgba(251,191,36,0.1)", borderRadius: 10, overflow: "hidden" }}>
                            {/* Group header */}
                            <div style={{ background: "rgba(251,191,36,0.04)", borderBottom: "1px solid rgba(251,191,36,0.1)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>{name}</span>
                                {group.length > 1 && (
                                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>{group.length}×</span>
                                )}
                                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(251,191,36,0.12)", color: "#fbbf24", letterSpacing: "0.08em" }}>GUESS</span>
                              </div>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {/* Suggested category shown as current guess */}
                                <span style={{ fontSize: 11, color: "#64748b" }}>suggested: </span>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: categoryColor(group[0].category)+"22", color: categoryColor(group[0].category) }}>{group[0].category}</span>
                                <button onClick={() => openBulk(group[0])}
                                  style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.25)", borderRadius: 6, padding: "5px 12px", color: "#00e5ff", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                                  {group.length > 1 ? `CATEGORIZE ALL ${group.length}` : "CATEGORIZE"}
                                </button>
                              </div>
                            </div>
                            {/* Individual transactions in group */}
                            {group.map((t) => (
                              <div key={t.id} style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div>
                                  {t.description && <div style={{ fontSize: 11, color: "#475569" }}>{t.description}</div>}
                                  <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{t.date}</div>
                                </div>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  <span style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>{fmt(t.amount)}</span>
                                  <select
                                    value={t.category}
                                    onChange={(e) => updateOne(t.id, e.target.value)}
                                    style={DROP}
                                  >
                                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                              </div>
                            ))}
                          </div>
                        ));
                      })()}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── INTERNAL ───────────────────────────────────────────────── */}
            {activeTab === "internal" && (
              <div className="space-y-4">
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-1">Internal Transfers</div>
                  <p style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>
                    Transactions labeled <span style={{ color: "#94a3b8", fontWeight: 600 }}>Internal</span> are visible here but excluded from income totals, expense totals, charts, and budget comparisons. Label both legs of an internal transfer to keep your books clean.
                  </p>

                  {/* Smart suggestions section */}
                  {suggestedButNotLabeled.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#94a3b8", fontFamily: "'Orbitron',sans-serif" }}>
                          🔄 SUGGESTED PAIRS — {suggestedButNotLabeled.length} transactions
                        </div>
                        <button onClick={() => markAllSuggestedInternal(suggestedButNotLabeled.map((t) => t.id))}
                          style={{ background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "6px 14px", color: "#94a3b8", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                          MARK ALL AS INTERNAL
                        </button>
                      </div>
                      {suggestedButNotLabeled.map((t) => (
                        <div key={t.id} style={{ padding: "10px 16px", marginBottom: 6, border: "1px solid rgba(148,163,184,0.15)", borderRadius: 8, background: "rgba(148,163,184,0.03)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, color: "#cbd5e1" }}>{t.name}</span>
                              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 10, background: "rgba(148,163,184,0.15)", color: "#94a3b8" }}>
                                {t.amount > 0 ? "↓ incoming" : "↑ outgoing"}
                              </span>
                            </div>
                            {t.description && <div style={{ fontSize: 11, color: "#475569" }}>{t.description}</div>}
                            <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{t.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: t.amount > 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{fmt(t.amount)}</span>
                            <button onClick={() => updateOne(t.id, INTERNAL)}
                              style={{ background: "rgba(148,163,184,0.12)", border: "1px solid rgba(148,163,184,0.3)", borderRadius: 6, padding: "5px 12px", color: "#94a3b8", fontFamily: "'Orbitron',sans-serif", fontSize: 9, cursor: "pointer" }}>
                              MARK INTERNAL
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Already-labeled Internal transactions */}
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: "0.15em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 10 }}>
                      ✓ LABELED INTERNAL — {internalT.length} transaction{internalT.length !== 1 ? "s" : ""}
                      {internalT.length > 0 && (
                        <span style={{ color: "#334155", marginLeft: 10, fontSize: 10, fontFamily: "'Exo 2',sans-serif", letterSpacing: 0 }}>
                          ({fmt(internalT.reduce((s,t)=>s+Math.abs(t.amount),0))} excluded from totals)
                        </span>
                      )}
                    </div>
                    {internalT.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 0", color: "#334155", fontSize: 13 }}>
                        No transactions labeled Internal yet.
                      </div>
                    ) : (
                      internalT.map((t) => (
                        <div key={t.id} style={{ padding: "10px 16px", marginBottom: 6, border: "1px solid rgba(255,255,255,0.04)", borderRadius: 8, background: "rgba(0,0,0,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
                          <div>
                            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 3 }}>{t.name}</div>
                            {t.description && <div style={{ fontSize: 11, color: "#334155" }}>{t.description}</div>}
                            <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>{t.date}</div>
                          </div>
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>{fmt(t.amount)}</span>
                            {/* Allow un-labeling */}
                            <select value={t.category} onChange={(e) => updateOne(t.id, e.target.value)} style={{ ...DROP, fontSize: 11, padding: "4px 8px" }}>
                              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── RAW DATA ───────────────────────────────────────────────── */}
            {activeTab === "raw" && (
              <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{filteredTxns.length} entries</div>
                  <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ ...DROP, padding: "6px 12px", fontSize: 12 }}>
                    <option value="All">All Categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Date","Name","Amount","Category",""].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron',sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredTxns].sort((a,b) => b.date.localeCompare(a.date)).map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding: "9px 10px", color: "#475569", whiteSpace: "nowrap" }}>{t.date}</td>
                          <td style={{ padding: "9px 10px", maxWidth: 200 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                              <ConfBadge c={t.confidence} />
                            </div>
                            {t.description && <div style={{ fontSize: 10, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</div>}
                          </td>
                          <td style={{ padding: "9px 10px", whiteSpace: "nowrap", color: t.amount >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{fmt(t.amount)}</td>
                          <td style={{ padding: "9px 10px" }}>
                            {editingId === t.id ? (
                              <select defaultValue={t.category} onChange={(e) => updateOne(t.id, e.target.value)} onBlur={() => setEditingId(null)} autoFocus style={DROP}>
                                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <span onClick={() => openBulk(t)} title="Click to categorize"
                                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, background: categoryColor(t.category)+"22", color: categoryColor(t.category), cursor: "pointer" }}>
                                {t.category} <span style={{ fontSize: 9, opacity: 0.6 }}>✎</span>
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "9px 10px" }}>
                            <button onClick={() => setTransactions((p) => p.filter((x) => x.id !== t.id))} style={{ background: "rgba(248,113,113,0.1)", border: "none", borderRadius: 4, padding: "3px 10px", color: "#f87171", fontSize: 11, cursor: "pointer" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── SUBSCRIPTIONS ──────────────────────────────────────────── */}
            {activeTab === "subscriptions" && (
              <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Auto-Detected Recurring Payments</div>
                <div className="text-xs text-muted-foreground mb-6">Payments with similar amounts appearing multiple times are flagged as subscriptions.</div>
                {subscriptions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#334155", fontSize: 13 }}>No recurring payments detected yet.</div>
                ) : (
                  <>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {["Merchant","Amount","Frequency","Occurrences","Est. Monthly"].map((h) => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron',sans-serif" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((s) => (
                          <tr key={s.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                            <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{s.name}</td>
                            <td style={{ padding: "10px 12px", color: "#f87171" }}>{fmt(s.amount)}</td>
                            <td style={{ padding: "10px 12px" }}><span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: "rgba(0,229,255,0.1)", color: "#00e5ff" }}>{s.frequency}</span></td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{s.occurrences}×</td>
                            <td style={{ padding: "10px 12px", color: "#fb923c", fontWeight: 600 }}>{fmt(s.monthlyEstimate)}/mo</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.15)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>ESTIMATED TOTAL MONTHLY</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: "#fb923c", fontFamily: "'Orbitron',sans-serif" }}>{fmt(subscriptions.reduce((s, sub) => s + sub.monthlyEstimate, 0))}/mo</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── RULES ──────────────────────────────────────────────────── */}
            {activeTab === "rules" && (
              <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-2">Saved Categorization Rules</div>
                <p style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>
                  Rules are applied automatically on every future CSV import. Created when you choose "Apply to All" in the review flow.
                </p>
                {rules.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#334155", fontSize: 13 }}>
                    No rules yet — categorize repeated transactions using "Apply to All" to create them.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["TRANSACTION NAME","CATEGORY",""].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron',sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{r.name}</td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, background: categoryColor(r.category)+"22", color: categoryColor(r.category) }}>{r.category}</span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <button onClick={() => deleteRule(r.name)} style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 4, padding: "3px 10px", color: "#f87171", fontSize: 11, cursor: "pointer" }}>✕ delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* ── ADD ENTRY ──────────────────────────────────────────────── */}
            {activeTab === "add" && (
              <div className="border border-border/60 rounded-lg p-8 bg-card/40 backdrop-blur-sm max-w-lg">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-8">Manually Add Transaction</div>
                <div className="space-y-5">
                  {[
                    { label: "DATE",                        type: "date",   key: "date",        placeholder: "" },
                    { label: "NAME / MERCHANT",             type: "text",   key: "name",        placeholder: "e.g. Albert Heijn" },
                    { label: "DESCRIPTION (optional)",      type: "text",   key: "description", placeholder: "Optional note" },
                    { label: "AMOUNT (use − for expenses)", type: "number", key: "amount",      placeholder: "-25.50" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: 10, letterSpacing: "0.15em", color: "#475569", marginBottom: 6, fontFamily: "'Orbitron',sans-serif" }}>{field.label}</label>
                      <input type={field.type} placeholder={field.placeholder} value={(form as any)[field.key]}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} style={inputStyle}
                        onFocus={(e) => (e.target.style.borderColor = "hsl(var(--primary))")}
                        onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 10, letterSpacing: "0.15em", color: "#475569", marginBottom: 6, fontFamily: "'Orbitron',sans-serif" }}>CATEGORY</label>
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...DROP, width: "100%", padding: "10px 14px", fontSize: 13 }}>
                      {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button onClick={addManual} className="w-full mt-2 px-6 py-3 rounded border border-primary/50 text-primary hover:bg-primary/10 transition-all duration-300 tracking-widest text-xs" style={{ fontFamily: "'Orbitron',sans-serif" }}>
                    + ADD TRANSACTION
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {drillCategory && (
        <DrillDownPanel
          category={drillCategory}
          transactions={drillTxns}
          categories={categories}
          onClose={() => setDrillCategory(null)}
          onRelabel={relabelTransaction}
        />
      )}

      {showCompare && (
        <BudgetCompareModal rows={buildComparisonRows()} onClose={() => setShowCompare(false)} />
      )}

      {bulkTxn && (
        <BulkDialog
          txn={bulkTxn}
          dupCount={dupCount(bulkTxn.name)}
          categories={categories}
          onApplyOne={(cat) => applyOne(bulkTxn.id, cat)}
          onApplyAll={(cat) => applyAll(bulkTxn.name, cat)}
          onClose={() => setBulkTxn(null)}
        />
      )}
    </div>
  );
}
