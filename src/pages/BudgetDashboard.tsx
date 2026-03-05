import { useState, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  date: string;
  name: string;
  description: string;
  amount: number;
  category: string;
  manual?: boolean;
}

// ─── Category Rules ───────────────────────────────────────────────────────────
const CATEGORY_RULES: { label: string; color: string; keywords: string[] }[] = [
  {
    label: "Groceries",
    color: "#4ade80",
    keywords: ["albert heijn", "ah ", "lidl", "jumbo", "aldi", "plus supermarkt", "dirk", "ah zeist", "albert heijn 1014"],
  },
  {
    label: "Housing & VvE",
    color: "#60a5fa",
    keywords: ["vve", "hypotheek", "mortgage", "huur", "rent", "woning"],
  },
  {
    label: "Insurance",
    color: "#a78bfa",
    keywords: ["fbto", "verzeker", "insurance", "rheinland", "credit life", "overlijdens"],
  },
  {
    label: "Personal Care",
    color: "#f472b6",
    keywords: ["kruidvat", "etos", "trekpleister", "douglas", "hema", "kapper", "salon"],
  },
  {
    label: "Transport & Fuel",
    color: "#fb923c",
    keywords: ["tinq", "shell", "bp ", "esso", "total", "benzine", "ns ", "ov-chipkaart", "parkeer", "parking"],
  },
  {
    label: "Fitness & Health",
    color: "#34d399",
    keywords: ["basic fit", "sportschool", "gym", "apotheek", "pharmacy", "huisarts", "ziekenhuis"],
  },
  {
    label: "Income",
    color: "#fbbf24",
    keywords: ["salaris", "salary", "loon", "inkomen"],
  },
  {
    label: "Shopping",
    color: "#f87171",
    keywords: ["argos", "readshop", "bol.com", "amazon", "zalando", "h&m", "zara", "primark", "ikea"],
  },
  {
    label: "Storage & Misc Services",
    color: "#94a3b8",
    keywords: ["stalling", "storage", "bck*"],
  },
];

const OTHER_COLOR = "#64748b";

function categorize(name: string, description: string): string {
  const haystack = `${name} ${description}`.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) return rule.label;
  }
  return "Other";
}

function categoryColor(cat: string): string {
  return CATEGORY_RULES.find((r) => r.label === cat)?.color ?? OTHER_COLOR;
}

// ─── CSV Parser (BUNQ format) ─────────────────────────────────────────────────
function parseAmount(raw: string): number {
  // BUNQ uses "1.160,68" format — remove dots (thousands), replace comma with dot
  return parseFloat(raw.replace(/\./g, "").replace(",", "."));
}

function parseCSV(text: string): Transaction[] {
  const lines = text.trim().split("\n");
  const rows = lines.slice(1); // skip header
  return rows
    .map((line, i) => {
      // parse quoted CSV fields
      const fields: string[] = [];
      let cur = "";
      let inQ = false;
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === "," && !inQ) { fields.push(cur); cur = ""; continue; }
        cur += ch;
      }
      fields.push(cur);
      const [date, , amountRaw, , , name, description] = fields;
      const amount = parseAmount(amountRaw ?? "0");
      return {
        id: `csv-${i}`,
        date: date?.trim() ?? "",
        name: name?.trim() ?? "",
        description: description?.trim() ?? "",
        amount,
        category: categorize(name ?? "", description ?? ""),
      };
    })
    .filter((t) => !isNaN(t.amount));
}

// ─── Summary helpers ──────────────────────────────────────────────────────────
function summarize(txns: Transaction[]) {
  const totalIn = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount);
  }
  return { totalIn, totalOut: Math.abs(totalOut), byCategory };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

// ─── Download helper ──────────────────────────────────────────────────────────
function downloadCSV(txns: Transaction[]) {
  const header = "Date,Name,Description,Amount,Category";
  const rows = txns.map(
    (t) => `"${t.date}","${t.name}","${t.description}","${t.amount}","${t.category}"`
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "budget-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── All categories for dropdown ─────────────────────────────────────────────
const ALL_CATEGORIES = [...CATEGORY_RULES.map((r) => r.label), "Other", "Transfer", "Unknown"];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BudgetDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "raw" | "add">("overview");
  const [filter, setFilter] = useState("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual add form
  const [form, setForm] = useState({ date: "", name: "", description: "", amount: "", category: ALL_CATEGORIES[0] });

  const loadFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setTransactions(parseCSV(text));
      setActiveTab("overview");
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const { totalIn, totalOut, byCategory } = summarize(transactions);
  const net = totalIn - totalOut;

  const pieData = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const barData = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const filteredTxns =
    filter === "All" ? transactions : transactions.filter((t) => t.category === filter);

  const updateCategory = (id: string, cat: string) => {
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category: cat } : t)));
    setEditingId(null);
  };

  const addManual = () => {
    if (!form.date || !form.name || !form.amount) return;
    const newTx: Transaction = {
      id: `manual-${Date.now()}`,
      date: form.date,
      name: form.name,
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      manual: true,
    };
    setTransactions((prev) => [...prev, newTx]);
    setForm({ date: "", name: "", description: "", amount: "", category: ALL_CATEGORIES[0] });
    setActiveTab("raw");
  };

  const deleteTxn = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1a", color: "#e2e8f0", fontFamily: "'DM Mono', 'Fira Mono', monospace" }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0f1a; } ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        .tab-btn { background: none; border: none; cursor: pointer; padding: 10px 20px; font-family: inherit; font-size: 13px; letter-spacing: 0.08em; transition: all 0.2s; }
        .tab-btn.active { color: #fbbf24; border-bottom: 2px solid #fbbf24; }
        .tab-btn:not(.active) { color: #64748b; }
        .tab-btn:hover:not(.active) { color: #94a3b8; }
        .drop-zone { border: 2px dashed #1e3a5f; border-radius: 16px; padding: 60px 40px; text-align: center; transition: all 0.3s; cursor: pointer; }
        .drop-zone.drag-over { border-color: #60a5fa; background: rgba(96,165,250,0.05); }
        .btn { border: none; border-radius: 8px; padding: 10px 20px; font-family: inherit; font-size: 12px; letter-spacing: 0.08em; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: #fbbf24; color: #0a0f1a; font-weight: 700; }
        .btn-primary:hover { background: #f59e0b; }
        .btn-ghost { background: #1e293b; color: #94a3b8; }
        .btn-ghost:hover { background: #273548; color: #e2e8f0; }
        .btn-danger { background: #3f1a1a; color: #f87171; }
        .btn-danger:hover { background: #5a1f1f; }
        .input { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 10px 14px; color: #e2e8f0; font-family: inherit; font-size: 13px; width: 100%; outline: none; }
        .input:focus { border-color: #60a5fa; }
        select.input option { background: #0f172a; }
        .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; padding: 24px; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; letter-spacing: 0.06em; font-weight: 500; }
        .row-hover:hover { background: #111827 !important; }
        .stat-card { background: linear-gradient(135deg, #0f172a 0%, #131f35 100%); border: 1px solid #1e293b; border-radius: 14px; padding: 20px 24px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "20px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.01em" }}>
            BUDGET.DASHBOARD
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 2, letterSpacing: "0.1em" }}>BUNQ · PERSONAL FINANCE</div>
        </div>
        {transactions.length > 0 && (
          <button className="btn btn-ghost" onClick={() => downloadCSV(transactions)}>
            ↓ EXPORT CSV
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* Drop Zone (always visible if no data) */}
        {transactions.length === 0 ? (
          <div
            className={`drop-zone ${dragging ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            <div style={{ fontSize: 40, marginBottom: 16 }}>📂</div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
              Drop your BUNQ CSV here
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>or click to browse · supports BUNQ export format</div>
          </div>
        ) : (
          <>
            {/* Re-upload button */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: "#475569", letterSpacing: "0.08em" }}>
                {transactions.length} TRANSACTIONS LOADED
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { setTransactions([]); setActiveTab("overview"); }}>
                ↺ LOAD NEW FILE
              </button>
            </div>

            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 32 }}>
              <div className="stat-card">
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 8 }}>TOTAL INCOME</div>
                <div style={{ fontSize: 26, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#4ade80" }}>{fmt(totalIn)}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 8 }}>TOTAL EXPENSES</div>
                <div style={{ fontSize: 26, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: "#f87171" }}>{fmt(totalOut)}</div>
              </div>
              <div className="stat-card">
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 8 }}>NET BALANCE</div>
                <div style={{ fontSize: 26, fontFamily: "'Syne', sans-serif", fontWeight: 800, color: net >= 0 ? "#60a5fa" : "#fb923c" }}>{fmt(net)}</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: "1px solid #1e293b", marginBottom: 28, display: "flex", gap: 4 }}>
              {(["overview", "raw", "add"] as const).map((tab) => (
                <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab === "overview" ? "OVERVIEW" : tab === "raw" ? "RAW DATA" : "+ ADD ENTRY"}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                {/* Pie Chart */}
                <div className="card">
                  <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 20 }}>SPENDING BY CATEGORY</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={categoryColor(entry.name)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontFamily: "inherit", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legend */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 12 }}>
                    {pieData.map((d) => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: categoryColor(d.name), flexShrink: 0 }} />
                        <span style={{ color: "#94a3b8" }}>{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="card">
                  <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 20 }}>TOP SPENDING CATEGORIES</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: "#475569", fontFamily: "inherit" }} tickFormatter={(v) => `€${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "inherit" }} width={110} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontFamily: "inherit", fontSize: 12 }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {barData.map((entry) => (
                          <Cell key={entry.name} fill={categoryColor(entry.name)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Category breakdown table */}
                <div className="card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 20 }}>CATEGORY BREAKDOWN</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1e293b" }}>
                        {["Category", "Transactions", "Total Spent", "% of Expenses"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.1em", fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                        const count = transactions.filter((t) => t.category === cat && t.amount < 0).length;
                        const pct = totalOut > 0 ? ((total / totalOut) * 100).toFixed(1) : "0";
                        return (
                          <tr key={cat} className="row-hover" style={{ borderBottom: "1px solid #0f172a" }}>
                            <td style={{ padding: "10px 12px" }}>
                              <span className="badge" style={{ background: categoryColor(cat) + "22", color: categoryColor(cat) }}>{cat}</span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#64748b" }}>{count}</td>
                            <td style={{ padding: "10px 12px", color: "#f87171" }}>{fmt(total)}</td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ height: 4, width: 80, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: categoryColor(cat), borderRadius: 2 }} />
                                </div>
                                <span style={{ color: "#64748b", fontSize: 12 }}>{pct}%</span>
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

            {/* ── RAW DATA TAB ──────────────────────────────────────────── */}
            {activeTab === "raw" && (
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em" }}>ALL TRANSACTIONS — {filteredTxns.length} ENTRIES</div>
                  <select className="input" style={{ width: "auto" }} value={filter} onChange={(e) => setFilter(e.target.value)}>
                    <option value="All">All Categories</option>
                    {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1e293b" }}>
                        {["Date", "Name", "Description", "Amount", "Category", ""].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.1em", fontWeight: 500, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTxns.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                        <tr key={t.id} className="row-hover" style={{ borderBottom: "1px solid #0d1420" }}>
                          <td style={{ padding: "9px 10px", color: "#475569", whiteSpace: "nowrap" }}>{t.date}</td>
                          <td style={{ padding: "9px 10px", color: "#e2e8f0", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</td>
                          <td style={{ padding: "9px 10px", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                          <td style={{ padding: "9px 10px", whiteSpace: "nowrap", color: t.amount >= 0 ? "#4ade80" : "#f87171", fontWeight: 500 }}>{fmt(t.amount)}</td>
                          <td style={{ padding: "9px 10px" }}>
                            {editingId === t.id ? (
                              <select className="input" style={{ padding: "4px 8px", fontSize: 11 }} defaultValue={t.category} onChange={(e) => updateCategory(t.id, e.target.value)} onBlur={() => setEditingId(null)} autoFocus>
                                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <span className="badge" style={{ background: categoryColor(t.category) + "22", color: categoryColor(t.category), cursor: "pointer" }} onClick={() => setEditingId(t.id)} title="Click to edit">
                                {t.category}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "9px 10px" }}>
                            <button className="btn btn-danger" style={{ padding: "3px 10px", fontSize: 10 }} onClick={() => deleteTxn(t.id)}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ADD ENTRY TAB ─────────────────────────────────────────── */}
            {activeTab === "add" && (
              <div className="card" style={{ maxWidth: 540 }}>
                <div style={{ fontSize: 11, color: "#475569", letterSpacing: "0.1em", marginBottom: 24 }}>MANUALLY ADD TRANSACTION</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>DATE</label>
                    <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>NAME / MERCHANT</label>
                    <input type="text" className="input" placeholder="e.g. Albert Heijn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>DESCRIPTION (optional)</label>
                    <input type="text" className="input" placeholder="Optional note" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>AMOUNT (use - for expenses)</label>
                    <input type="number" className="input" placeholder="-25.50" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", display: "block", marginBottom: 6 }}>CATEGORY</label>
                    <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                      {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={addManual}>
                    + ADD TRANSACTION
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
