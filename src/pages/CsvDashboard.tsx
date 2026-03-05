import { useState, useCallback, useRef } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  { label: "Groceries",            color: "#4ade80", keywords: ["albert heijn", "ah ", "ah zeist", "lidl", "jumbo", "aldi", "plus supermarkt", "dirk"] },
  { label: "Housing & VvE",        color: "#60a5fa", keywords: ["vve", "hypotheek", "mortgage", "huur", "rent", "woning"] },
  { label: "Insurance",            color: "#a78bfa", keywords: ["fbto", "verzeker", "insurance", "rheinland", "credit life", "overlijdens"] },
  { label: "Personal Care",        color: "#f472b6", keywords: ["kruidvat", "etos", "trekpleister", "douglas", "hema", "kapper", "salon"] },
  { label: "Transport & Fuel",     color: "#fb923c", keywords: ["tinq", "shell", "bp ", "esso", "total", "benzine", "ns ", "ov-chipkaart", "parkeer", "parking"] },
  { label: "Fitness & Health",     color: "#34d399", keywords: ["basic fit", "sportschool", "gym", "apotheek", "pharmacy", "huisarts", "ziekenhuis"] },
  { label: "Income",               color: "#00e5ff", keywords: ["salaris", "salary", "loon", "inkomen"] },
  { label: "Shopping",             color: "#f87171", keywords: ["argos", "readshop", "bol.com", "amazon", "zalando", "h&m", "zara", "primark", "ikea"] },
  { label: "Storage & Services",   color: "#94a3b8", keywords: ["stalling", "storage", "bck*"] },
];

const OTHER_COLOR = "#334155";

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

// ─── CSV Parser ───────────────────────────────────────────────────────────────
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
      id: `csv-${i}`,
      date: date?.trim() ?? "",
      name: name?.trim() ?? "",
      description: description?.trim() ?? "",
      amount,
      category: categorize(name ?? "", description ?? ""),
    };
  }).filter((t) => !isNaN(t.amount));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function summarize(txns: Transaction[]) {
  const totalIn  = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalOut = txns.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const t of txns) {
    if (t.amount < 0) byCategory[t.category] = (byCategory[t.category] ?? 0) + Math.abs(t.amount);
  }
  return { totalIn, totalOut: Math.abs(totalOut), byCategory };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

function downloadCSV(txns: Transaction[]) {
  const header = "Date,Name,Description,Amount,Category";
  const rows = txns.map((t) => `"${t.date}","${t.name}","${t.description}","${t.amount}","${t.category}"`);
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "budget-export.csv"; a.click();
  URL.revokeObjectURL(url);
}

const ALL_CATEGORIES = [...CATEGORY_RULES.map((r) => r.label), "Other", "Transfer", "Unknown"];

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length) {
    return (
      <div style={{ background: "rgba(0,0,0,0.9)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 8, padding: "10px 14px", fontFamily: "'Exo 2', sans-serif", fontSize: 12 }}>
        <div style={{ color: "#94a3b8", marginBottom: 4 }}>{payload[0].name}</div>
        <div style={{ color: "#00e5ff", fontWeight: 600 }}>{fmt(payload[0].value)}</div>
      </div>
    );
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CsvDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dragging, setDragging]         = useState(false);
  const [activeTab, setActiveTab]       = useState<"overview" | "raw" | "add">("overview");
  const [filter, setFilter]             = useState("All");
  const [editingId, setEditingId]       = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ date: "", name: "", description: "", amount: "", category: ALL_CATEGORIES[0] });

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

  const { totalIn, totalOut, byCategory } = summarize(transactions);
  const net = totalIn - totalOut;

  const pieData = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const barData = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const filteredTxns = filter === "All" ? transactions : transactions.filter((t) => t.category === filter);

  const updateCategory = (id: string, cat: string) => {
    setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, category: cat } : t));
    setEditingId(null);
  };

  const addManual = () => {
    if (!form.date || !form.name || !form.amount) return;
    setTransactions((prev) => [...prev, {
      id: `manual-${Date.now()}`, date: form.date, name: form.name,
      description: form.description, amount: parseFloat(form.amount),
      category: form.category, manual: true,
    }]);
    setForm({ date: "", name: "", description: "", amount: "", category: ALL_CATEGORIES[0] });
    setActiveTab("raw");
  };

  const tabs: { id: "overview" | "raw" | "add"; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "raw",      label: "RAW DATA" },
    { id: "add",      label: "+ ADD ENTRY" },
  ];

  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2', sans-serif" }}>
      <ConstellationBackground />
      <Header />

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-16">

        {/* Page Title */}
        <div className="text-center mb-14">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Finance Tool</p>
          <h1 className="text-4xl font-bold text-foreground mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Budget Dashboard
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Upload your BUNQ CSV export and get instant visual breakdowns of your spending.
          </p>
        </div>

        {/* Drop Zone */}
        {transactions.length === 0 ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer mx-auto max-w-lg"
            style={{
              border: `2px dashed ${dragging ? "hsl(var(--primary))" : "rgba(0,229,255,0.2)"}`,
              borderRadius: 12,
              padding: "64px 40px",
              textAlign: "center",
              background: dragging ? "rgba(0,229,255,0.03)" : "rgba(0,229,255,0.01)",
              transition: "all 0.3s",
            }}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
            <div style={{ fontSize: 36, marginBottom: 16 }}>📂</div>
            <div className="text-foreground font-semibold mb-2" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, letterSpacing: "0.05em" }}>
              DROP YOUR BUNQ CSV
            </div>
            <div className="text-muted-foreground text-xs tracking-wider">or click to browse</div>
          </div>
        ) : (
          <>
            {/* Top bar */}
            <div className="flex justify-between items-center mb-8">
              <span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                {transactions.length} transactions loaded
              </span>
              <div className="flex gap-3">
                <button
                  onClick={() => downloadCSV(transactions)}
                  className="text-xs tracking-widest px-4 py-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-all"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  ↓ EXPORT
                </button>
                <button
                  onClick={() => { setTransactions([]); setActiveTab("overview"); }}
                  className="text-xs tracking-widest px-4 py-2 rounded border border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary transition-all"
                  style={{ fontFamily: "'Orbitron', sans-serif" }}
                >
                  ↺ NEW FILE
                </button>
              </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-3 gap-4 mb-10">
              {[
                { label: "TOTAL INCOME",   value: fmt(totalIn),  color: "#4ade80" },
                { label: "TOTAL EXPENSES", value: fmt(totalOut), color: "#f87171" },
                { label: "NET BALANCE",    value: fmt(net),      color: net >= 0 ? "hsl(var(--primary))" : "#fb923c" },
              ].map((s) => (
                <div key={s.label} className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground mb-3 uppercase">{s.label}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'Orbitron', sans-serif", color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border/40 mb-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-5 py-3 text-xs tracking-[0.15em] transition-all duration-200"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    color: activeTab === tab.id ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    borderBottom: activeTab === tab.id ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW ─────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Pie */}
                  <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                    <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">Spending by Category</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value">
                          {pieData.map((entry) => <Cell key={entry.name} fill={categoryColor(entry.name)} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                      {pieData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-[11px]">
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: categoryColor(d.name), flexShrink: 0 }} />
                          <span className="text-muted-foreground">{d.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bar */}
                  <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                    <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">Top Categories</div>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#475569", fontFamily: "'Exo 2', sans-serif" }} tickFormatter={(v) => `€${v}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#64748b", fontFamily: "'Exo 2', sans-serif" }} width={115} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {barData.map((entry) => <Cell key={entry.name} fill={categoryColor(entry.name)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Breakdown table */}
                <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm hover:border-primary/40 transition-all duration-500">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-6">Category Breakdown</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Category", "Transactions", "Total Spent", "% of Expenses"].map((h) => (
                          <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron', sans-serif" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                        const count = transactions.filter((t) => t.category === cat && t.amount < 0).length;
                        const pct = totalOut > 0 ? ((total / totalOut) * 100).toFixed(1) : "0";
                        return (
                          <tr key={cat} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, background: categoryColor(cat) + "22", color: categoryColor(cat), letterSpacing: "0.05em" }}>{cat}</span>
                            </td>
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

            {/* ── RAW DATA ──────────────────────────────────────────────── */}
            {activeTab === "raw" && (
              <div className="border border-border/60 rounded-lg p-6 bg-card/40 backdrop-blur-sm">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">{filteredTxns.length} entries</div>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 12px", color: "hsl(var(--foreground))", fontFamily: "'Exo 2', sans-serif", fontSize: 12, outline: "none" }}
                  >
                    <option value="All">All Categories</option>
                    {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Date", "Name", "Description", "Amount", "Category", ""].map((h) => (
                          <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 10, color: "#475569", letterSpacing: "0.12em", fontWeight: 500, fontFamily: "'Orbitron', sans-serif", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTxns.sort((a, b) => b.date.localeCompare(a.date)).map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02] transition-colors">
                          <td style={{ padding: "9px 10px", color: "#475569", whiteSpace: "nowrap" }}>{t.date}</td>
                          <td style={{ padding: "9px 10px", color: "hsl(var(--foreground))", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</td>
                          <td style={{ padding: "9px 10px", color: "#64748b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</td>
                          <td style={{ padding: "9px 10px", whiteSpace: "nowrap", color: t.amount >= 0 ? "#4ade80" : "#f87171", fontWeight: 600 }}>{fmt(t.amount)}</td>
                          <td style={{ padding: "9px 10px" }}>
                            {editingId === t.id ? (
                              <select
                                defaultValue={t.category}
                                onChange={(e) => updateCategory(t.id, e.target.value)}
                                onBlur={() => setEditingId(null)}
                                autoFocus
                                style={{ background: "rgba(0,0,0,0.6)", border: "1px solid hsl(var(--primary))", borderRadius: 6, padding: "3px 8px", color: "hsl(var(--foreground))", fontFamily: "'Exo 2', sans-serif", fontSize: 11, outline: "none" }}
                              >
                                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            ) : (
                              <span
                                onClick={() => setEditingId(t.id)}
                                title="Click to edit"
                                style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, background: categoryColor(t.category) + "22", color: categoryColor(t.category), cursor: "pointer", letterSpacing: "0.04em" }}
                              >
                                {t.category}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "9px 10px" }}>
                            <button
                              onClick={() => setTransactions((prev) => prev.filter((x) => x.id !== t.id))}
                              style={{ background: "rgba(248,113,113,0.1)", border: "none", borderRadius: 4, padding: "3px 10px", color: "#f87171", fontSize: 11, cursor: "pointer" }}
                            >✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ADD ENTRY ─────────────────────────────────────────────── */}
            {activeTab === "add" && (
              <div className="border border-border/60 rounded-lg p-8 bg-card/40 backdrop-blur-sm max-w-lg hover:border-primary/40 transition-all duration-500">
                <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mb-8">Manually Add Transaction</div>
                <div className="space-y-5">
                  {[
                    { label: "DATE", type: "date",   key: "date",        placeholder: "" },
                    { label: "NAME / MERCHANT", type: "text", key: "name", placeholder: "e.g. Albert Heijn" },
                    { label: "DESCRIPTION (optional)", type: "text", key: "description", placeholder: "Optional note" },
                    { label: "AMOUNT (use − for expenses)", type: "number", key: "amount", placeholder: "-25.50" },
                  ].map((field) => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: 10, letterSpacing: "0.15em", color: "#475569", marginBottom: 6, fontFamily: "'Orbitron', sans-serif" }}>{field.label}</label>
                      <input
                        type={field.type}
                        placeholder={field.placeholder}
                        value={(form as any)[field.key]}
                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                        style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", color: "hsl(var(--foreground))", fontFamily: "'Exo 2', sans-serif", fontSize: 13, outline: "none" }}
                        onFocus={(e) => e.target.style.borderColor = "hsl(var(--primary))"}
                        onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                      />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 10, letterSpacing: "0.15em", color: "#475569", marginBottom: 6, fontFamily: "'Orbitron', sans-serif" }}>CATEGORY</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", color: "hsl(var(--foreground))", fontFamily: "'Exo 2', sans-serif", fontSize: 13, outline: "none" }}
                    >
                      {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={addManual}
                    className="w-full mt-2 px-6 py-3 rounded border border-primary/50 text-primary hover:bg-primary/10 transition-all duration-300 tracking-widest text-xs"
                    style={{ fontFamily: "'Orbitron', sans-serif" }}
                  >
                    + ADD TRANSACTION
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
