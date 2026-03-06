import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SavingsRow   { id: string; name: string; currency: string; balance: string; }
interface StockRow     { id: string; ticker: string; label: string; shares: string; purchasePrice: string; currentPrice: number | null; change24h: number | null; sparkline: number[]; error?: boolean; }
interface CryptoRow    { id: string; coinId: string; symbol: string; label: string; amount: string; purchasePrice: string; currentPrice: number | null; change24h: number | null; sparkline: number[]; error?: boolean; }
interface OtherRow     { id: string; name: string; value: string; }
interface LiabilityRow { id: string; name: string; amount: string; }
interface Snapshot     { date: string; value: number; }

type Category = "all" | "savings" | "stocks" | "crypto" | "other" | "liabilities";
type SortBy   = "best24h" | "worst24h" | "highestValue" | "lowestValue" | "bestReturn" | "worstReturn" | "alphabetical";
type ViewMode = "standard" | "heatmap";
type Period   = "7d" | "1m" | "3m" | "all";

const STORAGE_KEY = "networth_tracker_v1";
const SNAP_KEY    = "networth_snapshots_v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const fmtEur = (n: number, currency = "EUR") =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const pctColor = (n: number) => n >= 0 ? "#4ade80" : "#f87171";

const CATEGORY_COLORS: Record<string, string> = {
  Savings: "#60a5fa", Stocks: "#4ade80", Crypto: "#fbbf24", Other: "#a78bfa", Liabilities: "#f87171",
};

// ─── Sparkline Component ──────────────────────────────────────────────────────
const Sparkline = ({ data, positive }: { data: number[]; positive: boolean }) => {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 24 }} />;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const w = 60, h = 24, pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={positive ? "#4ade80" : "#f87171"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 16 }: { w?: string | number; h?: number }) => (
  <div style={{ width: w, height: h, background: "linear-gradient(90deg,#1e293b 25%,#263348 50%,#1e293b 75%)", backgroundSize: "200% 100%", borderRadius: 4, animation: "shimmer 1.5s infinite" }} />
);

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ label, total, color, open, onToggle, count }: { label: string; total: number; color: string; open: boolean; onToggle: () => void; count: number }) => (
  <div onClick={onToggle} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "14px 20px", borderRadius: open ? "10px 10px 0 0" : 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", userSelect: "none" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
      <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.08em" }}>{label}</span>
      <span style={{ fontSize: 10, color: "#475569", background: "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: 20 }}>{count}</span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 800, color }}>{fmtEur(total)}</span>
      <span style={{ color: "#475569", fontSize: 12, transition: "transform 0.3s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
    </div>
  </div>
);

// ─── Row styles ───────────────────────────────────────────────────────────────
const rowStyle: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", padding: "10px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "background 0.2s" };
const inputS: React.CSSProperties = { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "7px 11px", color: "#e2e8f0", fontFamily: "'Exo 2',sans-serif", fontSize: 12, outline: "none" };
const delBtn: React.CSSProperties = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 5, padding: "5px 10px", color: "#f87171", fontSize: 11, cursor: "pointer" };
const addBtn = (color: string): React.CSSProperties => ({ width: "100%", background: "none", border: `1px dashed ${color}44`, borderRadius: "0 0 10px 10px", padding: "10px", color, fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer" });

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NetWorthTracker() {
  const [savings,     setSavings]     = useState<SavingsRow[]>([{ id: uid(), name: "ING Checking", currency: "EUR", balance: "" }]);
  const [stocks,      setStocks]      = useState<StockRow[]>([]);
  const [crypto,      setCrypto]      = useState<CryptoRow[]>([]);
  const [other,       setOther]       = useState<OtherRow[]>([{ id: uid(), name: "Real Estate", value: "" }]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([{ id: uid(), name: "Mortgage", amount: "" }]);
  const [snapshots,   setSnapshots]   = useState<Snapshot[]>([]);

  const [openSections, setOpenSections] = useState({ savings: true, stocks: true, crypto: true, other: true, liabilities: true, leaderboard: false });
  const [editMode,   setEditMode]   = useState(false);
  const [privacy,    setPrivacy]    = useState(false);
  const [currency,   setCurrency]   = useState("EUR");
  const [period,     setPeriod]     = useState<Period>("1m");
  const [category,   setCategory]   = useState<Category>("all");
  const [sortBy,     setSortBy]     = useState<SortBy>("highestValue");
  const [viewMode,   setViewMode]   = useState<ViewMode>("standard");
  const [search,     setSearch]     = useState("");
  const [loading,    setLoading]    = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const savingsRef     = useRef<HTMLDivElement>(null);
  const stocksRef      = useRef<HTMLDivElement>(null);
  const cryptoRef      = useRef<HTMLDivElement>(null);
  const otherRef       = useRef<HTMLDivElement>(null);
  const liabilitiesRef = useRef<HTMLDivElement>(null);

  // ── Load from storage ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.savings)     setSavings(d.savings);
        if (d.stocks)      setStocks(d.stocks.map((s: StockRow) => ({ ...s, currentPrice: null, change24h: null, sparkline: [] })));
        if (d.crypto)      setCrypto(d.crypto.map((c: CryptoRow) => ({ ...c, currentPrice: null, change24h: null, sparkline: [] })));
        if (d.other)       setOther(d.other);
        if (d.liabilities) setLiabilities(d.liabilities);
        if (d.currency)    setCurrency(d.currency);
      }
      const snaps = localStorage.getItem(SNAP_KEY);
      if (snaps) setSnapshots(JSON.parse(snaps));
    } catch {}
  }, []);

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savings, stocks, crypto, other, liabilities, currency }));
    } catch {}
  }, [savings, stocks, crypto, other, liabilities, currency]);

  // ── Fetch prices ─────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    // Crypto via CoinGecko
    const coinIds = crypto.filter(c => c.coinId).map(c => c.coinId).join(",");
    if (coinIds) {
      try {
        const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids=${coinIds}&price_change_percentage=24h&sparkline=true`);
        const data = await res.json();
        setCrypto(prev => prev.map(c => {
          const found = data.find((d: any) => d.id === c.coinId);
          if (!found) return { ...c, error: true };
          return { ...c, currentPrice: found.current_price, change24h: found.price_change_percentage_24h, sparkline: found.sparkline_in_7d?.price?.filter((_: any, i: number) => i % 4 === 0) ?? [], error: false };
        }));
      } catch {}
    }
    // Stocks via CORS proxy
    const proxy = "https://corsproxy.io/?";
    for (const stock of stocks) {
      if (!stock.ticker) continue;
      try {
        const url = `${proxy}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${stock.ticker}?interval=1d&range=7d`)}`;
        const res = await fetch(url);
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) { setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, error: true } : s)); continue; }
        const closes = result.indicators?.quote?.[0]?.close ?? [];
        const current = closes[closes.length - 1];
        const prev1   = closes[closes.length - 2];
        const chg = prev1 ? ((current - prev1) / prev1) * 100 : 0;
        setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, currentPrice: current, change24h: chg, sparkline: closes.filter(Boolean), error: false } : s));
      } catch {
        setStocks(prev => prev.map(s => s.id === stock.id ? { ...s, error: true } : s));
      }
    }
    setLastUpdated(new Date().toLocaleTimeString("nl-NL"));
    setLoading(false);
  }, [crypto, stocks]);

  useEffect(() => { if (crypto.length || stocks.length) fetchPrices(); }, []);
  useEffect(() => {
    const interval = setInterval(() => { if (crypto.length || stocks.length) fetchPrices(); }, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalSavings     = savings.reduce((s, r) => s + (parseFloat(r.balance) || 0), 0);
  const totalStocks      = stocks.reduce((s, r) => s + (r.currentPrice ?? 0) * (parseFloat(r.shares) || 0), 0);
  const totalCrypto      = crypto.reduce((s, r) => s + (r.currentPrice ?? 0) * (parseFloat(r.amount) || 0), 0);
  const totalOther       = other.reduce((s, r) => s + (parseFloat(r.value) || 0), 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const totalAssets      = totalSavings + totalStocks + totalCrypto + totalOther;
  const netWorth         = totalAssets - totalLiabilities;

  const totalCost  = [...stocks.map(s => (parseFloat(s.purchasePrice)||0)*(parseFloat(s.shares)||0)), ...crypto.map(c => (parseFloat(c.purchasePrice)||0)*(parseFloat(c.amount)||0))].reduce((a,b)=>a+b,0);
  const totalValue = totalStocks + totalCrypto;
  const totalReturn = totalCost > 0 ? totalValue - totalCost : 0;
  const totalReturnPct = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // ── Daily snapshot ───────────────────────────────────────────────────────
  useEffect(() => {
    if (netWorth === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    setSnapshots(prev => {
      const existing = prev.findIndex(s => s.date === today);
      const updated = existing >= 0
        ? prev.map((s, i) => i === existing ? { ...s, value: netWorth } : s)
        : [...prev, { date: today, value: netWorth }];
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });
  }, [netWorth]);

  // ── Graph data ───────────────────────────────────────────────────────────
  const getGraphData = () => {
    const now = new Date();
    const cutoff = new Date();
    if (period === "7d") cutoff.setDate(now.getDate() - 7);
    else if (period === "1m") cutoff.setMonth(now.getMonth() - 1);
    else if (period === "3m") cutoff.setMonth(now.getMonth() - 3);
    else cutoff.setFullYear(2000);
    return snapshots.filter(s => new Date(s.date) >= cutoff);
  };
  const graphData = getGraphData();
  const periodStart = graphData[0]?.value ?? netWorth;
  const periodChange = netWorth - periodStart;
  const periodChangePct = periodStart > 0 ? (periodChange / periodStart) * 100 : 0;

  const bestDay  = snapshots.length > 1 ? snapshots.slice(1).reduce((best, s, i) => { const chg = s.value - snapshots[i].value; return chg > best.chg ? { date: s.date, chg } : best; }, { date: "", chg: -Infinity }) : null;
  const worstDay = snapshots.length > 1 ? snapshots.slice(1).reduce((worst, s, i) => { const chg = s.value - snapshots[i].value; return chg < worst.chg ? { date: s.date, chg } : worst; }, { date: "", chg: Infinity }) : null;

  // ── Allocation pie ────────────────────────────────────────────────────────
  const pieData = [
    { name: "Savings", value: totalSavings },
    { name: "Stocks",  value: totalStocks },
    { name: "Crypto",  value: totalCrypto },
    { name: "Other",   value: totalOther },
  ].filter(d => d.value > 0);

  // ── Winners / Losers ──────────────────────────────────────────────────────
  type AssetItem = { name: string; value: number; change24h: number | null; returnPct: number };
  const allAssets: AssetItem[] = [
    ...stocks.map(s => ({ name: s.ticker || s.label, value: (s.currentPrice ?? 0) * (parseFloat(s.shares) || 0), change24h: s.change24h, returnPct: s.purchasePrice ? (((s.currentPrice ?? 0) - parseFloat(s.purchasePrice)) / parseFloat(s.purchasePrice)) * 100 : 0 })),
    ...crypto.map(c => ({ name: c.symbol.toUpperCase() || c.label, value: (c.currentPrice ?? 0) * (parseFloat(c.amount) || 0), change24h: c.change24h, returnPct: c.purchasePrice ? (((c.currentPrice ?? 0) - parseFloat(c.purchasePrice)) / parseFloat(c.purchasePrice)) * 100 : 0 })),
  ];
  const sorted24h = [...allAssets].filter(a => a.change24h != null).sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const top3    = sorted24h.slice(0, 3);
  const bottom3 = sorted24h.slice(-3).reverse();

  // ── Leaderboard ───────────────────────────────────────────────────────────
  const leaderboard = [...allAssets].sort((a, b) => b.returnPct - a.returnPct);

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const scrollTo = (ref: React.RefObject<HTMLDivElement>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const pv = (n: number) => privacy ? "••••" : fmtEur(n, currency);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2', sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .nw-row:hover { background: rgba(255,255,255,0.015) !important; }
        .section-body { overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4,0,0.2,1); }
      `}</style>
      <ConstellationBackground />
      <Header />

      <main className="relative z-10" style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* ── Page Title ──────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <p style={{ fontSize: 10, letterSpacing: "0.25em", color: "hsl(var(--primary)/0.6)", marginBottom: 10, fontFamily: "'Orbitron', sans-serif" }}>FINANCE TOOL</p>
          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 34, fontWeight: 800, color: "#e2e8f0", marginBottom: 10 }}>Net Worth Tracker</h1>
          <p style={{ color: "#64748b", fontSize: 13 }}>Track assets, liabilities, and portfolio performance in real time.</p>
        </div>

        {/* ── Top Controls ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
          {lastUpdated && <span style={{ fontSize: 10, color: "#334155", letterSpacing: "0.08em" }}>UPDATED {lastUpdated}</span>}
          {loading && <span style={{ fontSize: 10, color: "#00e5ff", letterSpacing: "0.1em" }}>● FETCHING…</span>}
          <button onClick={fetchPrices} style={{ ...inputS, cursor: "pointer", fontSize: 10, letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif", padding: "7px 14px" }}>↻ REFRESH</button>
          <button onClick={() => setPrivacy(p => !p)} style={{ ...inputS, cursor: "pointer", fontSize: 10, letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif", padding: "7px 14px", color: privacy ? "#00e5ff" : "#64748b" }}>{privacy ? "👁 SHOW" : "🙈 HIDE"}</button>
          <button onClick={() => setEditMode(e => !e)} style={{ ...inputS, cursor: "pointer", fontSize: 10, letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif", padding: "7px 14px", color: editMode ? "#fbbf24" : "#64748b", borderColor: editMode ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.07)" }}>{editMode ? "✓ DONE" : "✎ EDIT"}</button>
          <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ ...inputS, cursor: "pointer", fontSize: 11 }}>
            <option value="EUR">EUR €</option>
            <option value="USD">USD $</option>
            <option value="GBP">GBP £</option>
          </select>
        </div>

        {/* ── Net Worth Hero ───────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", marginBottom: 32, padding: "32px 20px", border: "1px solid rgba(0,229,255,0.12)", borderRadius: 16, background: "rgba(0,229,255,0.02)" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#475569", fontFamily: "'Orbitron',sans-serif", marginBottom: 8 }}>TOTAL NET WORTH</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 48, fontWeight: 900, color: netWorth >= 0 ? "#00e5ff" : "#f87171", marginBottom: 8, letterSpacing: "-0.02em" }}>
            {privacy ? "••••••" : fmtEur(netWorth, currency)}
          </div>
          {totalCost > 0 && (
            <div style={{ fontSize: 13, color: totalReturn >= 0 ? "#4ade80" : "#f87171" }}>
              Total Return: {privacy ? "••" : fmtEur(totalReturn, currency)} ({fmtPct(totalReturnPct)})
            </div>
          )}
        </div>

        {/* ── Graph ────────────────────────────────────────────────────────── */}
        <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "24px", marginBottom: 24, background: "rgba(255,255,255,0.01)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>NET WORTH OVER TIME</div>
              <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700, color: periodChange >= 0 ? "#4ade80" : "#f87171" }}>
                  {periodChange >= 0 ? "+" : ""}{privacy ? "••" : fmtEur(periodChange, currency)}
                </span>
                <span style={{ fontSize: 12, color: periodChangePct >= 0 ? "#4ade80" : "#f87171" }}>{fmtPct(periodChangePct)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["7d","1m","3m","all"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ background: period === p ? "rgba(0,229,255,0.12)" : "none", border: `1px solid ${period === p ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.07)"}`, borderRadius: 6, padding: "5px 12px", color: period === p ? "#00e5ff" : "#475569", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.1em", cursor: "pointer" }}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {graphData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={graphData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#334155", fontFamily: "'Exo 2',sans-serif" }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 9, fill: "#334155", fontFamily: "'Exo 2',sans-serif" }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} width={45} />
                <Tooltip formatter={(v: number) => [fmtEur(v, currency), "Net Worth"]} contentStyle={{ background: "#080e1a", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 8, fontFamily: "'Exo 2',sans-serif", fontSize: 11 }} />
                <Line type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 }}>
              Add assets and return tomorrow to see your net worth graph.
            </div>
          )}
          {(bestDay || worstDay) && (
            <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
              {bestDay && bestDay.chg !== -Infinity && (
                <div style={{ flex: 1, padding: "10px 14px", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>BEST DAY</div>
                  <div style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{bestDay.date} · +{fmtEur(bestDay.chg, currency)}</div>
                </div>
              )}
              {worstDay && worstDay.chg !== Infinity && (
                <div style={{ flex: 1, padding: "10px 14px", background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 8 }}>
                  <div style={{ fontSize: 9, color: "#475569", letterSpacing: "0.12em", fontFamily: "'Orbitron',sans-serif", marginBottom: 4 }}>WORST DAY</div>
                  <div style={{ fontSize: 13, color: "#f87171", fontWeight: 600 }}>{worstDay.date} · {fmtEur(worstDay.chg, currency)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Allocation + Winners row ─────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          {/* Allocation donut */}
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px", background: "rgba(255,255,255,0.01)" }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron',sans-serif", marginBottom: 16 }}>ALLOCATION</div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={54} paddingAngle={2} dataKey="value"
                    onClick={(d) => {
                      setDrillCategory(d.name);
                      const refs: Record<string, React.RefObject<HTMLDivElement>> = { Savings: savingsRef, Stocks: stocksRef, Crypto: cryptoRef, Other: otherRef };
                      setTimeout(() => refs[d.name]?.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
                    }}
                    style={{ cursor: "pointer" }}>
                    {pieData.map(d => <Cell key={d.name} fill={CATEGORY_COLORS[d.name]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtEur(v, currency)} contentStyle={{ background: "#080e1a", border: "1px solid rgba(0,229,255,0.15)", borderRadius: 8, fontFamily: "'Exo 2',sans-serif", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {pieData.map(d => {
                  const pct = totalAssets > 0 ? ((d.value / totalAssets) * 100).toFixed(1) : "0";
                  return (
                    <div key={d.name} onClick={() => scrollTo({ Savings: savingsRef, Stocks: stocksRef, Crypto: cryptoRef, Other: otherRef }[d.name] ?? savingsRef)} style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", padding: "3px 6px", borderRadius: 4, background: drillCategory === d.name ? `${CATEGORY_COLORS[d.name]}15` : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: CATEGORY_COLORS[d.name] }} />
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Winners & Losers */}
          <div style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: "20px 24px", background: "rgba(255,255,255,0.01)" }}>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.15em", fontFamily: "'Orbitron',sans-serif", marginBottom: 14 }}>24H WINNERS & LOSERS</div>
            {allAssets.length === 0 ? (
              <div style={{ color: "#334155", fontSize: 12, textAlign: "center", paddingTop: 20 }}>Add stocks or crypto to see performance.</div>
            ) : (
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#4ade80", letterSpacing: "0.12em", marginBottom: 8 }}>TOP 3</div>
                  {top3.map(a => (
                    <div key={a.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#e2e8f0" }}>{a.name}</span>
                      <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>{fmtPct(a.change24h ?? 0)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.05)" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: "#f87171", letterSpacing: "0.12em", marginBottom: 8 }}>BOTTOM 3</div>
                  {bottom3.map(a => (
                    <div key={a.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#e2e8f0" }}>{a.name}</span>
                      <span style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>{fmtPct(a.change24h ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Filter / Sort Bar ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center", padding: "14px 16px", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, background: "rgba(255,255,255,0.01)" }}>
          <input placeholder="🔍 Search assets…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputS, flex: 1, minWidth: 160, fontSize: 12 }} />
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["all","savings","stocks","crypto","other","liabilities"] as Category[]).map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ background: category === c ? "rgba(0,229,255,0.1)" : "none", border: `1px solid ${category === c ? "rgba(0,229,255,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 5, padding: "5px 10px", color: category === c ? "#00e5ff" : "#475569", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", textTransform: "capitalize" }}>
                {c}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)} style={{ ...inputS, fontSize: 11, cursor: "pointer" }}>
            <option value="highestValue">Highest Value</option>
            <option value="lowestValue">Lowest Value</option>
            <option value="best24h">Best 24h</option>
            <option value="worst24h">Worst 24h</option>
            <option value="bestReturn">Best Return</option>
            <option value="worstReturn">Worst Return</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
            {(["standard","heatmap"] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)} style={{ background: viewMode === v ? "rgba(0,229,255,0.1)" : "none", border: "none", padding: "6px 12px", color: viewMode === v ? "#00e5ff" : "#475569", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.08em", cursor: "pointer", textTransform: "capitalize" }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ── Heatmap View ─────────────────────────────────────────────────── */}
        {viewMode === "heatmap" && allAssets.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
            {allAssets.filter(a => !search || a.name.toLowerCase().includes(search.toLowerCase())).map(a => {
              const chg = a.change24h ?? 0;
              const intensity = Math.min(Math.abs(chg) / 5, 1);
              const bg = chg >= 0 ? `rgba(74,222,128,${0.1 + intensity * 0.4})` : `rgba(248,113,113,${0.1 + intensity * 0.4})`;
              const weight = totalAssets > 0 ? (a.value / totalAssets) : 0.05;
              const size = Math.max(60, Math.min(160, weight * 600));
              return (
                <div key={a.name} style={{ width: size, height: size, background: bg, border: `1px solid ${chg >= 0 ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 6 }}>
                  <div style={{ fontSize: Math.max(9, size / 8), fontWeight: 700, color: "#e2e8f0", textAlign: "center" }}>{a.name}</div>
                  <div style={{ fontSize: Math.max(8, size / 10), color: chg >= 0 ? "#4ade80" : "#f87171" }}>{fmtPct(chg)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── SAVINGS ──────────────────────────────────────────────────────── */}
        {(category === "all" || category === "savings") && (
          <div ref={savingsRef} style={{ marginBottom: 12 }}>
            <SectionHeader label="SAVINGS" total={totalSavings} color={CATEGORY_COLORS.Savings} open={openSections.savings} onToggle={() => toggleSection("savings")} count={savings.length} />
            <div className="section-body" style={{ maxHeight: openSections.savings ? 2000 : 0, border: openSections.savings ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
              <div style={{ padding: "4px 0" }}>
                <div style={{ display: "flex", gap: 8, padding: "6px 20px 2px", fontSize: 9, color: "#334155", letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif" }}>
                  <span style={{ flex: 1 }}>NAME</span><span style={{ width: 80 }}>CURRENCY</span><span style={{ width: 130, textAlign: "right" }}>BALANCE</span>{editMode && <span style={{ width: 40 }} />}
                </div>
                {savings.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(r => (
                  <div key={r.id} className="nw-row" style={rowStyle}>
                    <input value={r.name} onChange={e => setSavings(p => p.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))} style={{ ...inputS, flex: 1 }} disabled={!editMode} />
                    <select value={r.currency} onChange={e => setSavings(p => p.map(x => x.id === r.id ? { ...x, currency: e.target.value } : x))} style={{ ...inputS, width: 80 }} disabled={!editMode}>
                      <option>EUR</option><option>USD</option><option>GBP</option>
                    </select>
                    <input type="number" placeholder="0.00" value={r.balance} onChange={e => setSavings(p => p.map(x => x.id === r.id ? { ...x, balance: e.target.value } : x))} style={{ ...inputS, width: 130, textAlign: "right" }} disabled={!editMode} />
                    {editMode && <button onClick={() => setSavings(p => p.filter(x => x.id !== r.id))} style={delBtn}>✕</button>}
                  </div>
                ))}
                {editMode && <button onClick={() => setSavings(p => [...p, { id: uid(), name: "", currency: "EUR", balance: "" }])} style={addBtn(CATEGORY_COLORS.Savings)}>+ ADD ACCOUNT</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── STOCKS ───────────────────────────────────────────────────────── */}
        {(category === "all" || category === "stocks") && (
          <div ref={stocksRef} style={{ marginBottom: 12 }}>
            <SectionHeader label="STOCKS" total={totalStocks} color={CATEGORY_COLORS.Stocks} open={openSections.stocks} onToggle={() => toggleSection("stocks")} count={stocks.length} />
            <div className="section-body" style={{ maxHeight: openSections.stocks ? 2000 : 0, border: openSections.stocks ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
              <div style={{ padding: "4px 0" }}>
                <div style={{ display: "flex", gap: 8, padding: "6px 20px 2px", fontSize: 9, color: "#334155", letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif" }}>
                  <span style={{ width: 70 }}>TICKER</span><span style={{ flex: 1 }}>LABEL</span><span style={{ width: 70 }}>SHARES</span><span style={{ width: 90 }}>BUY PRICE</span><span style={{ width: 90, textAlign: "right" }}>LIVE</span><span style={{ width: 70, textAlign: "right" }}>24H</span><span style={{ width: 90, textAlign: "right" }}>VALUE</span><span style={{ width: 80, textAlign: "right" }}>RETURN</span><span style={{ width: 64 }} />
                </div>
                {stocks.filter(r => !search || r.ticker.toLowerCase().includes(search.toLowerCase()) || r.label.toLowerCase().includes(search.toLowerCase())).map(r => {
                  const value = (r.currentPrice ?? 0) * (parseFloat(r.shares) || 0);
                  const cost  = (parseFloat(r.purchasePrice) || 0) * (parseFloat(r.shares) || 0);
                  const ret   = cost > 0 ? value - cost : null;
                  const retPct = cost > 0 ? ((value - cost) / cost) * 100 : null;
                  return (
                    <div key={r.id} className="nw-row" style={rowStyle}>
                      <input value={r.ticker} onChange={e => setStocks(p => p.map(x => x.id === r.id ? { ...x, ticker: e.target.value.toUpperCase() } : x))} style={{ ...inputS, width: 70, fontFamily: "'Orbitron',sans-serif", fontSize: 11 }} disabled={!editMode} placeholder="AAPL" />
                      <input value={r.label} onChange={e => setStocks(p => p.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))} style={{ ...inputS, flex: 1 }} disabled={!editMode} placeholder="Label…" />
                      <input type="number" value={r.shares} onChange={e => setStocks(p => p.map(x => x.id === r.id ? { ...x, shares: e.target.value } : x))} style={{ ...inputS, width: 70 }} disabled={!editMode} placeholder="0" />
                      <input type="number" value={r.purchasePrice} onChange={e => setStocks(p => p.map(x => x.id === r.id ? { ...x, purchasePrice: e.target.value } : x))} style={{ ...inputS, width: 90 }} disabled={!editMode} placeholder="0.00" />
                      <div style={{ width: 90, textAlign: "right" }}>
                        {r.error ? <span style={{ fontSize: 10, color: "#f87171" }}>ERR <button onClick={fetchPrices} style={{ background: "none", border: "none", color: "#00e5ff", cursor: "pointer", fontSize: 10 }}>↻</button></span>
                          : r.currentPrice == null ? <Skeleton w={70} h={14} />
                          : <span style={{ fontSize: 12, color: "#e2e8f0" }}>{fmtEur(r.currentPrice, currency)}</span>}
                      </div>
                      <div style={{ width: 70, textAlign: "right" }}>
                        {r.change24h != null ? <span style={{ fontSize: 12, color: pctColor(r.change24h) }}>{fmtPct(r.change24h)}</span> : <Skeleton w={50} h={14} />}
                      </div>
                      <div style={{ width: 90, textAlign: "right", fontSize: 12, color: "#e2e8f0" }}>{privacy ? "••" : fmtEur(value, currency)}</div>
                      <div style={{ width: 80, textAlign: "right" }}>
                        {ret != null ? <span style={{ fontSize: 11, color: pctColor(ret) }}>{privacy ? "••" : fmtEur(ret, currency)}<br /><span style={{ fontSize: 10 }}>{fmtPct(retPct!)}</span></span> : "—"}
                      </div>
                      <Sparkline data={r.sparkline} positive={(r.change24h ?? 0) >= 0} />
                      {editMode && <button onClick={() => setStocks(p => p.filter(x => x.id !== r.id))} style={delBtn}>✕</button>}
                    </div>
                  );
                })}
                {editMode && <button onClick={() => { const id = uid(); setStocks(p => [...p, { id, ticker: "", label: "", shares: "", purchasePrice: "", currentPrice: null, change24h: null, sparkline: [] }]); setTimeout(fetchPrices, 500); }} style={addBtn(CATEGORY_COLORS.Stocks)}>+ ADD STOCK</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── CRYPTO ───────────────────────────────────────────────────────── */}
        {(category === "all" || category === "crypto") && (
          <div ref={cryptoRef} style={{ marginBottom: 12 }}>
            <SectionHeader label="CRYPTO" total={totalCrypto} color={CATEGORY_COLORS.Crypto} open={openSections.crypto} onToggle={() => toggleSection("crypto")} count={crypto.length} />
            <div className="section-body" style={{ maxHeight: openSections.crypto ? 2000 : 0, border: openSections.crypto ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
              <div style={{ padding: "4px 0" }}>
                <div style={{ display: "flex", gap: 8, padding: "6px 20px 2px", fontSize: 9, color: "#334155", letterSpacing: "0.1em", fontFamily: "'Orbitron',sans-serif" }}>
                  <span style={{ width: 90 }}>COIN ID</span><span style={{ flex: 1 }}>LABEL</span><span style={{ width: 80 }}>AMOUNT</span><span style={{ width: 90 }}>BUY PRICE</span><span style={{ width: 90, textAlign: "right" }}>LIVE</span><span style={{ width: 70, textAlign: "right" }}>24H</span><span style={{ width: 90, textAlign: "right" }}>VALUE</span><span style={{ width: 80, textAlign: "right" }}>RETURN</span><span style={{ width: 64 }} />
                </div>
                {crypto.filter(r => !search || r.coinId.toLowerCase().includes(search.toLowerCase()) || r.label.toLowerCase().includes(search.toLowerCase())).map(r => {
                  const value = (r.currentPrice ?? 0) * (parseFloat(r.amount) || 0);
                  const cost  = (parseFloat(r.purchasePrice) || 0) * (parseFloat(r.amount) || 0);
                  const ret   = cost > 0 ? value - cost : null;
                  const retPct = cost > 0 ? ((value - cost) / cost) * 100 : null;
                  return (
                    <div key={r.id} className="nw-row" style={rowStyle}>
                      <input value={r.coinId} onChange={e => setCrypto(p => p.map(x => x.id === r.id ? { ...x, coinId: e.target.value.toLowerCase() } : x))} style={{ ...inputS, width: 90, fontFamily: "'Orbitron',sans-serif", fontSize: 11 }} disabled={!editMode} placeholder="bitcoin" />
                      <input value={r.label} onChange={e => setCrypto(p => p.map(x => x.id === r.id ? { ...x, label: e.target.value } : x))} style={{ ...inputS, flex: 1 }} disabled={!editMode} placeholder="Label…" />
                      <input type="number" value={r.amount} onChange={e => setCrypto(p => p.map(x => x.id === r.id ? { ...x, amount: e.target.value } : x))} style={{ ...inputS, width: 80 }} disabled={!editMode} placeholder="0.00" />
                      <input type="number" value={r.purchasePrice} onChange={e => setCrypto(p => p.map(x => x.id === r.id ? { ...x, purchasePrice: e.target.value } : x))} style={{ ...inputS, width: 90 }} disabled={!editMode} placeholder="0.00" />
                      <div style={{ width: 90, textAlign: "right" }}>
                        {r.error ? <span style={{ fontSize: 10, color: "#f87171" }}>ERR <button onClick={fetchPrices} style={{ background: "none", border: "none", color: "#00e5ff", cursor: "pointer", fontSize: 10 }}>↻</button></span>
                          : r.currentPrice == null ? <Skeleton w={70} h={14} />
                          : <span style={{ fontSize: 12, color: "#e2e8f0" }}>{fmtEur(r.currentPrice, currency)}</span>}
                      </div>
                      <div style={{ width: 70, textAlign: "right" }}>
                        {r.change24h != null ? <span style={{ fontSize: 12, color: pctColor(r.change24h) }}>{fmtPct(r.change24h)}</span> : <Skeleton w={50} h={14} />}
                      </div>
                      <div style={{ width: 90, textAlign: "right", fontSize: 12, color: "#e2e8f0" }}>{privacy ? "••" : fmtEur(value, currency)}</div>
                      <div style={{ width: 80, textAlign: "right" }}>
                        {ret != null ? <span style={{ fontSize: 11, color: pctColor(ret) }}>{privacy ? "••" : fmtEur(ret, currency)}<br /><span style={{ fontSize: 10 }}>{fmtPct(retPct!)}</span></span> : "—"}
                      </div>
                      <Sparkline data={r.sparkline} positive={(r.change24h ?? 0) >= 0} />
                      {editMode && <button onClick={() => setCrypto(p => p.filter(x => x.id !== r.id))} style={delBtn}>✕</button>}
                    </div>
                  );
                })}
                {editMode && <button onClick={() => { const id = uid(); setCrypto(p => [...p, { id, coinId: "", symbol: "", label: "", amount: "", purchasePrice: "", currentPrice: null, change24h: null, sparkline: [] }]); setTimeout(fetchPrices, 500); }} style={addBtn(CATEGORY_COLORS.Crypto)}>+ ADD COIN</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── OTHER ASSETS ─────────────────────────────────────────────────── */}
        {(category === "all" || category === "other") && (
          <div ref={otherRef} style={{ marginBottom: 12 }}>
            <SectionHeader label="OTHER ASSETS" total={totalOther} color={CATEGORY_COLORS.Other} open={openSections.other} onToggle={() => toggleSection("other")} count={other.length} />
            <div className="section-body" style={{ maxHeight: openSections.other ? 2000 : 0, border: openSections.other ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
              <div style={{ padding: "4px 0" }}>
                {other.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(r => (
                  <div key={r.id} className="nw-row" style={rowStyle}>
                    <input value={r.name} onChange={e => setOther(p => p.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))} style={{ ...inputS, flex: 1 }} disabled={!editMode} placeholder="e.g. Apartment, Car…" />
                    <input type="number" value={r.value} onChange={e => setOther(p => p.map(x => x.id === r.id ? { ...x, value: e.target.value } : x))} style={{ ...inputS, width: 140, textAlign: "right" }} disabled={!editMode} placeholder="0.00" />
                    {editMode && <button onClick={() => setOther(p => p.filter(x => x.id !== r.id))} style={delBtn}>✕</button>}
                  </div>
                ))}
                {editMode && <button onClick={() => setOther(p => [...p, { id: uid(), name: "", value: "" }])} style={addBtn(CATEGORY_COLORS.Other)}>+ ADD ASSET</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── LIABILITIES ──────────────────────────────────────────────────── */}
        {(category === "all" || category === "liabilities") && (
          <div ref={liabilitiesRef} style={{ marginBottom: 12 }}>
            <SectionHeader label="LIABILITIES" total={totalLiabilities} color={CATEGORY_COLORS.Liabilities} open={openSections.liabilities} onToggle={() => toggleSection("liabilities")} count={liabilities.length} />
            <div className="section-body" style={{ maxHeight: openSections.liabilities ? 2000 : 0, border: openSections.liabilities ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
              <div style={{ padding: "4px 0" }}>
                {liabilities.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(r => (
                  <div key={r.id} className="nw-row" style={rowStyle}>
                    <input value={r.name} onChange={e => setLiabilities(p => p.map(x => x.id === r.id ? { ...x, name: e.target.value } : x))} style={{ ...inputS, flex: 1 }} disabled={!editMode} placeholder="e.g. Mortgage, Student Loan…" />
                    <input type="number" value={r.amount} onChange={e => setLiabilities(p => p.map(x => x.id === r.id ? { ...x, amount: e.target.value } : x))} style={{ ...inputS, width: 140, textAlign: "right", color: "#f87171" }} disabled={!editMode} placeholder="0.00" />
                    {editMode && <button onClick={() => setLiabilities(p => p.filter(x => x.id !== r.id))} style={delBtn}>✕</button>}
                  </div>
                ))}
                {editMode && <button onClick={() => setLiabilities(p => [...p, { id: uid(), name: "", amount: "" }])} style={addBtn(CATEGORY_COLORS.Liabilities)}>+ ADD LIABILITY</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 12 }}>
          <SectionHeader label="PERFORMANCE LEADERBOARD" total={0} color="#00e5ff" open={openSections.leaderboard} onToggle={() => toggleSection("leaderboard")} count={leaderboard.length} />
          <div className="section-body" style={{ maxHeight: openSections.leaderboard ? 2000 : 0, border: openSections.leaderboard ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" }}>
            <div style={{ padding: "4px 0" }}>
              {leaderboard.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "#334155", fontSize: 12 }}>Add stocks or crypto with purchase prices to see rankings.</div>
              ) : leaderboard.map((a, i) => (
                <div key={a.name} className="nw-row" style={{ ...rowStyle, gap: 16 }}>
                  <span style={{ width: 28, fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 800, color: i === 0 ? "#fbbf24" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "#334155" }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "#e2e8f0" }}>{a.name}</span>
                  <span style={{ fontSize: 12, color: a.returnPct >= 0 ? "#4ade80" : "#f87171", fontWeight: 600, width: 70, textAlign: "right" }}>{fmtPct(a.returnPct)}</span>
                  <span style={{ fontSize: 12, color: "#64748b", width: 100, textAlign: "right" }}>{privacy ? "••" : fmtEur(a.value, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
      <Footer />
    </div>
  );
}
