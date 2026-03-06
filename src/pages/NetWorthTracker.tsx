import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

// ─── Fixed Coin List ──────────────────────────────────────────────────────────
const COINS = [
  { label: "Bitcoin",    symbol: "BTC",  id: "bitcoin" },
  { label: "Ethereum",   symbol: "ETH",  id: "ethereum" },
  { label: "XRP",        symbol: "XRP",  id: "ripple" },
  { label: "Solana",     symbol: "SOL",  id: "solana" },
  { label: "Hyperliquid",symbol: "HYPE", id: "hyperliquid" },
  { label: "Chainlink",  symbol: "LINK", id: "chainlink" },
  { label: "Avalanche",  symbol: "AVAX", id: "avalanche-2" },
  { label: "Zcash",      symbol: "ZEC",  id: "zcash" },
  { label: "USD Coin",   symbol: "USDC", id: "usd-coin" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction { id: string; date: string; amount: number; buyPrice: number; }
interface CryptoRow {
  id: string; coinId: string; symbol: string; label: string;
  totalAmount: number; avgBuyPrice: number;
  currentPrice: number | null; change24h: number | null; sparkline: number[];
  transactions: Transaction[]; error?: boolean; showHistory?: boolean;
}
interface StockRow {
  id: string; ticker: string; label: string; shares: string; purchasePrice: string;
  currentPrice: number | null; change24h: number | null; sparkline: number[]; error?: boolean;
}
interface SavingsRow   { id: string; name: string; currency: string; balance: string; }
interface OtherRow     { id: string; name: string; value: string; }
interface LiabilityRow { id: string; name: string; amount: string; }
interface Snapshot     { date: string; value: number; }
type Period   = "7d" | "1m" | "3m" | "all";
type Category = "all" | "savings" | "stocks" | "crypto";
type SortBy   = "best24h" | "worst24h" | "highestValue" | "lowestValue" | "bestReturn" | "worstReturn" | "alphabetical";
type ViewMode = "standard" | "heatmap";

const STORAGE_KEY = "networth_v2";
const SNAP_KEY    = "networth_snaps_v2";
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtCur = (n: number, cur = "EUR") =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const pc = (n: number) => n >= 0 ? "#4ade80" : "#f87171";

// ─── Sparkline ────────────────────────────────────────────────────────────────
const Sparkline = ({ data, positive }: { data: number[]; positive: boolean }) => {
  if (!data || data.length < 2) return <div style={{ width: 60, height: 24 }} />;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${24 - ((v - min) / range) * 20 - 2}`).join(" ");
  return <svg width={60} height={24} style={{ flexShrink: 0 }}><polyline points={pts} fill="none" stroke={positive ? "#4ade80" : "#f87171"} strokeWidth={1.5} strokeLinejoin="round" /></svg>;
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Sk = ({ w = 60 }: { w?: number }) => (
  <div style={{ width: w, height: 13, background: "linear-gradient(90deg,#1e293b 25%,#263348 50%,#1e293b 75%)", backgroundSize: "200% 100%", borderRadius: 3, animation: "shimmer 1.5s infinite" }} />
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const IS: React.CSSProperties = { background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "7px 11px", color: "#e2e8f0", fontFamily: "'Exo 2',sans-serif", fontSize: 12, outline: "none", transition: "border-color 0.2s" };
const DB: React.CSSProperties = { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 5, padding: "5px 10px", color: "#f87171", fontSize: 11, cursor: "pointer" };
const secStyle: React.CSSProperties = { marginBottom: 12 };
const hdrStyle = (open: boolean): React.CSSProperties => ({ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "14px 20px", borderRadius: open ? "10px 10px 0 0" : 10, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", userSelect: "none" });
const bodyStyle = (open: boolean): React.CSSProperties => ({ overflow: "hidden", maxHeight: open ? 9999 : 0, transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)", border: open ? "1px solid rgba(255,255,255,0.06)" : "none", borderTop: "none", borderRadius: "0 0 10px 10px", background: "rgba(255,255,255,0.005)" });
const rowS: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", padding: "9px 20px", borderBottom: "1px solid rgba(255,255,255,0.03)" };
const addBtnS = (color: string): React.CSSProperties => ({ width: "100%", background: "none", border: `1px dashed ${color}44`, borderRadius: "0 0 10px 10px", padding: "10px", color, fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.12em", cursor: "pointer" });
const CAT_COLORS: Record<string,string> = { Cash: "#60a5fa", Stocks: "#4ade80", Crypto: "#fbbf24" };

// ─── Section Header ───────────────────────────────────────────────────────────
const SecHdr = ({ label, total, color, open, toggle, count, cur }: { label:string; total:number; color:string; open:boolean; toggle:()=>void; count:number; cur:string }) => (
  <div onClick={toggle} style={hdrStyle(open)}>
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:8, height:8, borderRadius:"50%", background:color }} />
      <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:700, color:"#e2e8f0", letterSpacing:"0.08em" }}>{label}</span>
      <span style={{ fontSize:10, color:"#475569", background:"rgba(255,255,255,0.04)", padding:"2px 8px", borderRadius:20 }}>{count}</span>
    </div>
    <div style={{ display:"flex", alignItems:"center", gap:16 }}>
      <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:800, color }}>{fmtCur(total, cur)}</span>
      <span style={{ color:"#475569", fontSize:12, transition:"transform 0.3s", transform:open?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
    </div>
  </div>
);

// ─── Add Transaction Modal ────────────────────────────────────────────────────
const AddTxModal = ({ existingCoins, onConfirm, onClose, cur }: {
  existingCoins: string[];
  onConfirm: (coinId: string, amount: number, date: string, buyPrice: number) => void;
  onClose: () => void;
  cur: string;
}) => {
  const [coinId,   setCoinId]   = useState("");
  const [amount,   setAmount]   = useState("");
  const [date,     setDate]     = useState(new Date().toISOString().slice(0,10));
  const [buyPrice, setBuyPrice] = useState("");
  const [visible,  setVisible]  = useState(false);
  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);
  const close = () => { setVisible(false); setTimeout(onClose, 280); };
  const confirm = () => {
    if (!coinId || !amount || !buyPrice) return;
    onConfirm(coinId, parseFloat(amount), date, parseFloat(buyPrice));
    close();
  };
  return (
    <div onClick={close} style={{ position:"fixed", inset:0, zIndex:200, background:`rgba(0,0,0,${visible?0.75:0})`, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.28s" }}>
      <div onClick={e=>e.stopPropagation()} style={{ width:"min(460px,94vw)", background:"#080e1a", border:"1px solid rgba(0,229,255,0.18)", borderRadius:14, padding:32, transform:visible?"scale(1)":"scale(0.92)", opacity:visible?1:0, transition:"transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s" }}>
        <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.2em", fontFamily:"'Orbitron',sans-serif", marginBottom:6 }}>NEW TRANSACTION</div>
        <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:18, fontWeight:800, color:"#e2e8f0", marginBottom:24 }}>Add Transaction</div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Coin */}
          <div>
            <label style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>COIN</label>
            <select value={coinId} onChange={e=>setCoinId(e.target.value)} style={{ ...IS, width:"100%" }}>
              <option value="">Select a coin…</option>
              {COINS.map(c => (
                <option key={c.id} value={c.id} style={{ color: existingCoins.includes(c.id) && !existingCoins.find(x=>x===c.id) ? "#475569" : "#e2e8f0" }}>
                  {c.label} ({c.symbol}){existingCoins.includes(c.id) ? " — add to existing" : ""}
                </option>
              ))}
            </select>
          </div>
          {/* Amount */}
          <div>
            <label style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>AMOUNT (coins)</label>
            <input type="number" placeholder="e.g. 0.5" value={amount} onChange={e=>setAmount(e.target.value)} style={{ ...IS, width:"100%" }} />
          </div>
          {/* Date */}
          <div>
            <label style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>DATE</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ ...IS, width:"100%" }} />
          </div>
          {/* Buy price */}
          <div>
            <label style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", display:"block", marginBottom:6 }}>BUY PRICE PER COIN ({cur})</label>
            <input type="number" placeholder="e.g. 45000" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} style={{ ...IS, width:"100%" }} />
          </div>
          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button onClick={close} style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"11px", color:"#64748b", fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:"0.1em", cursor:"pointer" }}>CANCEL</button>
            <button onClick={confirm} style={{ flex:2, background:"rgba(0,229,255,0.1)", border:"1px solid rgba(0,229,255,0.3)", borderRadius:8, padding:"11px", color:"#00e5ff", fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:"0.1em", cursor:"pointer" }}>CONFIRM TRANSACTION</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function NetWorthTracker() {
  const [savings,     setSavings]     = useState<SavingsRow[]>([{ id:uid(), name:"ING Checking", currency:"EUR", balance:"" }]);
  const [stocks,      setStocks]      = useState<StockRow[]>([]);
  const [crypto,      setCrypto]      = useState<CryptoRow[]>([]);
  const [other,       setOther]       = useState<OtherRow[]>([]);
  const [liabilities, setLiabilities] = useState<LiabilityRow[]>([]);
  const [snapshots,   setSnapshots]   = useState<Snapshot[]>([]);
  const [open, setOpen]               = useState({ savings:true, stocks:true, crypto:true, other:true, liabilities:true, leaderboard:false });
  const [editMode,    setEditMode]    = useState(false);
  const [privacy,     setPrivacy]     = useState(false);
  const [currency,    setCurrency]    = useState("EUR");
  const [period,      setPeriod]      = useState<Period>("1m");
  const [category,    setCategory]    = useState<Category>("all");
  const [sortBy,      setSortBy]      = useState<SortBy>("highestValue");
  const [viewMode,    setViewMode]    = useState<ViewMode>("standard");
  const [search,      setSearch]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string|null>(null);
  const [showTxModal, setShowTxModal] = useState(false);

  const savingsRef = useRef<HTMLDivElement>(null);
  const stocksRef  = useRef<HTMLDivElement>(null);
  const cryptoRef  = useRef<HTMLDivElement>(null);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.savings)     setSavings(d.savings);
        if (d.stocks)      setStocks(d.stocks.map((s:StockRow) => ({ ...s, currentPrice:null, change24h:null, sparkline:[] })));
        if (d.crypto)      setCrypto(d.crypto.map((c:CryptoRow) => ({ ...c, currentPrice:null, change24h:null, sparkline:[] })));
        if (d.other)       setOther(d.other);
        if (d.liabilities) setLiabilities(d.liabilities);
        if (d.currency)    setCurrency(d.currency);
      }
      const snaps = localStorage.getItem(SNAP_KEY);
      if (snaps) setSnapshots(JSON.parse(snaps));
    } catch {}
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ savings, stocks, crypto, other, liabilities, currency })); } catch {}
  }, [savings, stocks, crypto, other, liabilities, currency]);

  // ── Fetch prices ────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    setLoading(true);
    // Crypto via CoinGecko
    const coinIds = crypto.filter(c=>c.coinId).map(c=>c.coinId).join(",");
    if (coinIds) {
      try {
        const res  = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids=${coinIds}&price_change_percentage=24h&sparkline=true`);
        const data = await res.json();
        setCrypto(prev => prev.map(c => {
          const f = data.find((d:any) => d.id === c.coinId);
          if (!f) return { ...c, error:true };
          return { ...c, currentPrice:f.current_price, change24h:f.price_change_percentage_24h, sparkline:f.sparkline_in_7d?.price?.filter((_:any,i:number)=>i%4===0)??[], error:false };
        }));
      } catch {}
    }
    // Stocks via CORS proxy + Yahoo Finance
    const proxy = "https://corsproxy.io/?";
    for (const s of stocks) {
      if (!s.ticker) continue;
      try {
        const url  = `${proxy}${encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?interval=1d&range=7d`)}`;
        const res  = await fetch(url);
        const data = await res.json();
        const r    = data?.chart?.result?.[0];
        if (!r) { setStocks(p=>p.map(x=>x.id===s.id?{...x,error:true}:x)); continue; }
        const closes = r.indicators?.quote?.[0]?.close??[];
        const cur    = closes[closes.length-1];
        const prv    = closes[closes.length-2];
        const chg    = prv ? ((cur-prv)/prv)*100 : 0;
        setStocks(p=>p.map(x=>x.id===s.id?{...x,currentPrice:cur,change24h:chg,sparkline:closes.filter(Boolean),error:false}:x));
      } catch {
        setStocks(p=>p.map(x=>x.id===s.id?{...x,error:true}:x));
      }
    }
    setLastUpdated(new Date().toLocaleTimeString("nl-NL"));
    setLoading(false);
  }, [crypto, stocks]);

  useEffect(() => { if (crypto.length||stocks.length) fetchPrices(); }, []);
  useEffect(() => {
    const iv = setInterval(() => { if (crypto.length||stocks.length) fetchPrices(); }, 60000);
    return () => clearInterval(iv);
  }, [fetchPrices]);

  // ── Add transaction ──────────────────────────────────────────────────────
  const addTransaction = (coinId: string, amount: number, date: string, buyPrice: number) => {
    const coin = COINS.find(c=>c.id===coinId)!;
    const tx: Transaction = { id:uid(), date, amount, buyPrice };
    setCrypto(prev => {
      const existing = prev.find(c=>c.coinId===coinId);
      if (existing) {
        return prev.map(c => {
          if (c.coinId !== coinId) return c;
          const newTotal = c.totalAmount + amount;
          const newAvg   = ((c.totalAmount * c.avgBuyPrice) + (amount * buyPrice)) / newTotal;
          return { ...c, totalAmount:newTotal, avgBuyPrice:newAvg, transactions:[...c.transactions, tx] };
        });
      }
      return [...prev, { id:uid(), coinId, symbol:coin.symbol, label:coin.label, totalAmount:amount, avgBuyPrice:buyPrice, currentPrice:null, change24h:null, sparkline:[], transactions:[tx] }];
    });
    setTimeout(fetchPrices, 300);
  };

  // ── Totals ───────────────────────────────────────────────────────────────
  const totalSavings     = savings.reduce((s,r)=>s+(parseFloat(r.balance)||0),0);
  const totalStocks      = stocks.reduce((s,r)=>s+(r.currentPrice??0)*(parseFloat(r.shares)||0),0);
  const totalCrypto      = crypto.reduce((s,r)=>s+(r.currentPrice??0)*r.totalAmount,0);
  const totalOther       = other.reduce((s,r)=>s+(parseFloat(r.value)||0),0);
  const totalLiabilities = liabilities.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
  const totalAssets      = totalSavings+totalStocks+totalCrypto+totalOther;
  const netWorth         = totalAssets-totalLiabilities;

  const totalCost   = [...stocks.map(s=>(parseFloat(s.purchasePrice)||0)*(parseFloat(s.shares)||0)), ...crypto.map(c=>c.avgBuyPrice*c.totalAmount)].reduce((a,b)=>a+b,0);
  const totalValue  = totalStocks+totalCrypto;
  const totalReturn = totalCost>0 ? totalValue-totalCost : 0;
  const totalRetPct = totalCost>0 ? (totalReturn/totalCost)*100 : 0;

  // ── Snapshot ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!netWorth) return;
    const today = new Date().toISOString().slice(0,10);
    setSnapshots(prev => {
      const idx = prev.findIndex(s=>s.date===today);
      const next = idx>=0 ? prev.map((s,i)=>i===idx?{...s,value:netWorth}:s) : [...prev,{date:today,value:netWorth}];
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [netWorth]);

  // ── Graph ────────────────────────────────────────────────────────────────
  const getGraph = () => {
    const now = new Date(), cut = new Date();
    if (period==="7d") cut.setDate(now.getDate()-7);
    else if (period==="1m") cut.setMonth(now.getMonth()-1);
    else if (period==="3m") cut.setMonth(now.getMonth()-3);
    else cut.setFullYear(2000);
    return snapshots.filter(s=>new Date(s.date)>=cut);
  };
  const graphData   = getGraph();
  const pStart      = graphData[0]?.value ?? netWorth;
  const pChange     = netWorth-pStart;
  const pChangePct  = pStart>0 ? (pChange/pStart)*100 : 0;
  const bestDay     = snapshots.length>1 ? snapshots.slice(1).reduce((b,s,i)=>{ const c=s.value-snapshots[i].value; return c>b.c?{date:s.date,c}:b; },{date:"",c:-Infinity}) : null;
  const worstDay    = snapshots.length>1 ? snapshots.slice(1).reduce((b,s,i)=>{ const c=s.value-snapshots[i].value; return c<b.c?{date:s.date,c}:b; },{date:"",c:Infinity}) : null;

  // ── Allocation (Cash/Stocks/Crypto only) ─────────────────────────────────
  const pieData = [
    { name:"Cash",   value:totalSavings },
    { name:"Stocks", value:totalStocks },
    { name:"Crypto", value:totalCrypto },
  ].filter(d=>d.value>0);

  // ── Winners/Losers ───────────────────────────────────────────────────────
  type AI = { name:string; value:number; change24h:number|null; returnPct:number };
  const allAssets: AI[] = [
    ...stocks.map(s=>({ name:s.ticker||s.label, value:(s.currentPrice??0)*(parseFloat(s.shares)||0), change24h:s.change24h, returnPct:s.purchasePrice?(((s.currentPrice??0)-parseFloat(s.purchasePrice))/parseFloat(s.purchasePrice))*100:0 })),
    ...crypto.map(c=>({ name:c.symbol, value:(c.currentPrice??0)*c.totalAmount, change24h:c.change24h, returnPct:c.avgBuyPrice?(((c.currentPrice??0)-c.avgBuyPrice)/c.avgBuyPrice)*100:0 })),
  ];
  const sorted24h = [...allAssets].filter(a=>a.change24h!=null).sort((a,b)=>(b.change24h??0)-(a.change24h??0));
  const top3    = sorted24h.slice(0,3);
  const bottom3 = sorted24h.slice(-3).reverse();
  const leaderboard = [...allAssets].sort((a,b)=>b.returnPct-a.returnPct);

  const pv = (n:number) => privacy ? "••••" : fmtCur(n, currency);
  const tog = (k: keyof typeof open) => setOpen(p=>({...p,[k]:!p[k]}));

  const focusB = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.target.style.borderColor="rgba(0,229,255,0.4)";
  const blurB  = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement>) => e.target.style.borderColor="rgba(255,255,255,0.07)";

  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily:"'Exo 2',sans-serif" }}>
      <style>{`
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .nwr:hover{background:rgba(255,255,255,0.015)!important}
      `}</style>
      <ConstellationBackground />
      <Header />

      <main className="relative z-10" style={{ maxWidth:1100, margin:"0 auto", padding:"40px 20px 80px" }}>

        {/* Title */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <p style={{ fontSize:10, letterSpacing:"0.25em", color:"hsl(var(--primary)/0.6)", marginBottom:10, fontFamily:"'Orbitron',sans-serif" }}>FINANCE TOOL</p>
          <h1 style={{ fontFamily:"'Orbitron',sans-serif", fontSize:32, fontWeight:900, color:"#e2e8f0", marginBottom:10 }}>Net Worth Tracker</h1>
          <p style={{ color:"#64748b", fontSize:13 }}>Real-time assets, liabilities and portfolio performance.</p>
        </div>

        {/* Controls */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          {lastUpdated && <span style={{ fontSize:10, color:"#334155", letterSpacing:"0.08em" }}>UPDATED {lastUpdated}</span>}
          {loading && <span style={{ fontSize:10, color:"#00e5ff" }}>● FETCHING…</span>}
          <button onClick={fetchPrices} style={{ ...IS, cursor:"pointer", fontSize:10, letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif", padding:"7px 14px" }}>↻ REFRESH</button>
          <button onClick={()=>setPrivacy(p=>!p)} style={{ ...IS, cursor:"pointer", fontSize:10, letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif", padding:"7px 14px", color:privacy?"#00e5ff":"#64748b" }}>{privacy?"👁 SHOW":"🙈 HIDE"}</button>
          <button onClick={()=>setEditMode(e=>!e)} style={{ ...IS, cursor:"pointer", fontSize:10, letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif", padding:"7px 14px", color:editMode?"#fbbf24":"#64748b", borderColor:editMode?"rgba(251,191,36,0.3)":"rgba(255,255,255,0.07)" }}>{editMode?"✓ DONE":"✎ EDIT"}</button>
          <select value={currency} onChange={e=>setCurrency(e.target.value)} style={{ ...IS, cursor:"pointer" }} onFocus={focusB} onBlur={blurB}>
            <option value="EUR">EUR €</option><option value="USD">USD $</option><option value="GBP">GBP £</option>
          </select>
          <button onClick={()=>setShowTxModal(true)} style={{ background:"rgba(0,229,255,0.1)", border:"1px solid rgba(0,229,255,0.3)", borderRadius:8, padding:"8px 18px", color:"#00e5ff", fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:"0.12em", cursor:"pointer" }}>
            + ADD TRANSACTION
          </button>
        </div>

        {/* Net Worth Hero */}
        <div style={{ textAlign:"center", marginBottom:28, padding:"28px 20px", border:"1px solid rgba(0,229,255,0.12)", borderRadius:16, background:"rgba(0,229,255,0.02)" }}>
          <div style={{ fontSize:10, letterSpacing:"0.2em", color:"#475569", fontFamily:"'Orbitron',sans-serif", marginBottom:8 }}>TOTAL NET WORTH</div>
          <div style={{ fontFamily:"'Orbitron',sans-serif", fontSize:44, fontWeight:900, color:netWorth>=0?"#00e5ff":"#f87171", marginBottom:8, letterSpacing:"-0.02em" }}>
            {privacy?"••••••":fmtCur(netWorth,currency)}
          </div>
          {totalCost>0 && (
            <div style={{ fontSize:13, color:totalReturn>=0?"#4ade80":"#f87171" }}>
              Total Return: {pv(totalReturn)} ({fmtPct(totalRetPct)})
            </div>
          )}
        </div>

        {/* Graph */}
        <div style={{ border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"22px", marginBottom:20, background:"rgba(255,255,255,0.01)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
            <div>
              <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>NET WORTH OVER TIME</div>
              <div style={{ display:"flex", gap:14, alignItems:"baseline" }}>
                <span style={{ fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:700, color:pChange>=0?"#4ade80":"#f87171" }}>{pChange>=0?"+":""}{pv(pChange)}</span>
                <span style={{ fontSize:12, color:pChangePct>=0?"#4ade80":"#f87171" }}>{fmtPct(pChangePct)}</span>
              </div>
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {(["7d","1m","3m","all"] as Period[]).map(p=>(
                <button key={p} onClick={()=>setPeriod(p)} style={{ background:period===p?"rgba(0,229,255,0.12)":"none", border:`1px solid ${period===p?"rgba(0,229,255,0.3)":"rgba(255,255,255,0.07)"}`, borderRadius:6, padding:"5px 12px", color:period===p?"#00e5ff":"#475569", fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:"0.1em", cursor:"pointer" }}>
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {graphData.length>1 ? (
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={graphData}>
                <XAxis dataKey="date" tick={{ fontSize:9, fill:"#334155", fontFamily:"'Exo 2',sans-serif" }} tickFormatter={d=>d.slice(5)} />
                <YAxis tick={{ fontSize:9, fill:"#334155", fontFamily:"'Exo 2',sans-serif" }} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} width={44} />
                <Tooltip formatter={(v:number)=>[fmtCur(v,currency),"Net Worth"]} contentStyle={{ background:"#080e1a", border:"1px solid rgba(0,229,255,0.2)", borderRadius:8, fontFamily:"'Exo 2',sans-serif", fontSize:11 }} />
                <Line type="monotone" dataKey="value" stroke="#00e5ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height:170, display:"flex", alignItems:"center", justifyContent:"center", color:"#334155", fontSize:12 }}>Add assets and return tomorrow to see your graph.</div>
          )}
          {(bestDay||worstDay) && (
            <div style={{ display:"flex", gap:14, marginTop:14 }}>
              {bestDay && bestDay.c!==-Infinity && <div style={{ flex:1, padding:"10px 14px", background:"rgba(74,222,128,0.05)", border:"1px solid rgba(74,222,128,0.15)", borderRadius:8 }}><div style={{ fontSize:9, color:"#475569", letterSpacing:"0.12em", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>BEST DAY</div><div style={{ fontSize:12, color:"#4ade80", fontWeight:600 }}>{bestDay.date} · +{fmtCur(bestDay.c,currency)}</div></div>}
              {worstDay && worstDay.c!==Infinity && <div style={{ flex:1, padding:"10px 14px", background:"rgba(248,113,113,0.05)", border:"1px solid rgba(248,113,113,0.15)", borderRadius:8 }}><div style={{ fontSize:9, color:"#475569", letterSpacing:"0.12em", fontFamily:"'Orbitron',sans-serif", marginBottom:4 }}>WORST DAY</div><div style={{ fontSize:12, color:"#f87171", fontWeight:600 }}>{worstDay.date} · {fmtCur(worstDay.c,currency)}</div></div>}
            </div>
          )}
        </div>

        {/* Allocation + Winners */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
          <div style={{ border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"20px 22px", background:"rgba(255,255,255,0.01)" }}>
            <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", marginBottom:14 }}>ALLOCATION</div>
            <div style={{ display:"flex", gap:18, alignItems:"center" }}>
              <ResponsiveContainer width={110} height={110}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={2} dataKey="value"
                    onClick={d=>{ const refs:Record<string,React.RefObject<HTMLDivElement>>={Cash:savingsRef,Stocks:stocksRef,Crypto:cryptoRef}; refs[d.name]?.current?.scrollIntoView({behavior:"smooth",block:"start"}); }}
                    style={{ cursor:"pointer" }}>
                    {pieData.map(d=><Cell key={d.name} fill={CAT_COLORS[d.name]} />)}
                  </Pie>
                  <Tooltip formatter={(v:number)=>fmtCur(v,currency)} contentStyle={{ background:"#080e1a", border:"1px solid rgba(0,229,255,0.15)", borderRadius:8, fontFamily:"'Exo 2',sans-serif", fontSize:11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex:1, display:"flex", flexDirection:"column", gap:7 }}>
                {pieData.map(d=>{
                  const pct = totalAssets>0?((d.value/totalAssets)*100).toFixed(1):"0";
                  return (
                    <div key={d.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:CAT_COLORS[d.name] }} />
                        <span style={{ fontSize:11, color:"#94a3b8" }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize:11, color:"#64748b" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, padding:"20px 22px", background:"rgba(255,255,255,0.01)" }}>
            <div style={{ fontSize:10, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Orbitron',sans-serif", marginBottom:12 }}>24H WINNERS & LOSERS</div>
            {allAssets.length===0 ? <div style={{ color:"#334155", fontSize:12, textAlign:"center", paddingTop:16 }}>Add stocks or crypto to see performance.</div> : (
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:"#4ade80", letterSpacing:"0.12em", marginBottom:8 }}>TOP 3</div>
                  {top3.map(a=><div key={a.name} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}><span style={{ fontSize:12, color:"#e2e8f0" }}>{a.name}</span><span style={{ fontSize:12, color:"#4ade80", fontWeight:600 }}>{fmtPct(a.change24h??0)}</span></div>)}
                </div>
                <div style={{ width:1, background:"rgba(255,255,255,0.05)" }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:9, color:"#f87171", letterSpacing:"0.12em", marginBottom:8 }}>BOTTOM 3</div>
                  {bottom3.map(a=><div key={a.name} style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}><span style={{ fontSize:12, color:"#e2e8f0" }}>{a.name}</span><span style={{ fontSize:12, color:"#f87171", fontWeight:600 }}>{fmtPct(a.change24h??0)}</span></div>)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ display:"flex", gap:8, marginBottom:18, flexWrap:"wrap", alignItems:"center", padding:"12px 16px", border:"1px solid rgba(255,255,255,0.05)", borderRadius:10, background:"rgba(255,255,255,0.01)" }}>
          <input placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...IS, flex:1, minWidth:140, fontSize:12 }} />
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {(["all","savings","stocks","crypto"] as Category[]).map(c=>(
              <button key={c} onClick={()=>setCategory(c)} style={{ background:category===c?"rgba(0,229,255,0.1)":"none", border:`1px solid ${category===c?"rgba(0,229,255,0.3)":"rgba(255,255,255,0.06)"}`, borderRadius:5, padding:"5px 10px", color:category===c?"#00e5ff":"#475569", fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:"0.08em", cursor:"pointer", textTransform:"capitalize" }}>{c}</button>
            ))}
          </div>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value as SortBy)} style={{ ...IS, fontSize:11, cursor:"pointer" }} onFocus={focusB} onBlur={blurB}>
            <option value="highestValue">Highest Value</option>
            <option value="lowestValue">Lowest Value</option>
            <option value="best24h">Best 24h</option>
            <option value="worst24h">Worst 24h</option>
            <option value="bestReturn">Best Return</option>
            <option value="worstReturn">Worst Return</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <div style={{ display:"flex", border:"1px solid rgba(255,255,255,0.06)", borderRadius:6, overflow:"hidden" }}>
            {(["standard","heatmap"] as ViewMode[]).map(v=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{ background:viewMode===v?"rgba(0,229,255,0.1)":"none", border:"none", padding:"6px 12px", color:viewMode===v?"#00e5ff":"#475569", fontFamily:"'Orbitron',sans-serif", fontSize:9, letterSpacing:"0.08em", cursor:"pointer", textTransform:"capitalize" }}>{v}</button>
            ))}
          </div>
        </div>

        {/* Heatmap */}
        {viewMode==="heatmap" && allAssets.length>0 && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:20 }}>
            {allAssets.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase())).map(a=>{
              const chg=a.change24h??0, intensity=Math.min(Math.abs(chg)/5,1);
              const bg=chg>=0?`rgba(74,222,128,${0.1+intensity*0.4})`:`rgba(248,113,113,${0.1+intensity*0.4})`;
              const size=Math.max(60,Math.min(160,(totalAssets>0?(a.value/totalAssets):0.05)*600));
              return <div key={a.name} style={{ width:size, height:size, background:bg, border:`1px solid ${chg>=0?"rgba(74,222,128,0.3)":"rgba(248,113,113,0.3)"}`, borderRadius:8, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:6 }}><div style={{ fontSize:Math.max(9,size/8), fontWeight:700, color:"#e2e8f0", textAlign:"center" }}>{a.name}</div><div style={{ fontSize:Math.max(8,size/10), color:chg>=0?"#4ade80":"#f87171" }}>{fmtPct(chg)}</div></div>;
            })}
          </div>
        )}

        {/* ── SAVINGS ─────────────────────────────────────────────────────── */}
        {(category==="all"||category==="savings") && (
          <div ref={savingsRef} style={secStyle}>
            <SecHdr label="SAVINGS" total={totalSavings} color={CAT_COLORS.Cash} open={open.savings} toggle={()=>tog("savings")} count={savings.length} cur={currency} />
            <div style={bodyStyle(open.savings)}>
              <div style={{ padding:"4px 0" }}>
                <div style={{ display:"flex", gap:8, padding:"6px 20px 2px", fontSize:9, color:"#334155", letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif" }}>
                  <span style={{ flex:1 }}>NAME</span><span style={{ width:80 }}>CURRENCY</span><span style={{ width:120, textAlign:"right" }}>BALANCE</span>{editMode&&<span style={{ width:40 }} />}
                </div>
                {savings.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())).map(r=>(
                  <div key={r.id} className="nwr" style={rowS}>
                    <input value={r.name} onChange={e=>setSavings(p=>p.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} style={{ ...IS, flex:1 }} disabled={!editMode} onFocus={focusB} onBlur={blurB} />
                    <select value={r.currency} onChange={e=>setSavings(p=>p.map(x=>x.id===r.id?{...x,currency:e.target.value}:x))} style={{ ...IS, width:80 }} disabled={!editMode} onFocus={focusB} onBlur={blurB}><option>EUR</option><option>USD</option><option>GBP</option></select>
                    <input type="number" placeholder="0.00" value={r.balance} onChange={e=>setSavings(p=>p.map(x=>x.id===r.id?{...x,balance:e.target.value}:x))} style={{ ...IS, width:120, textAlign:"right" }} disabled={!editMode} onFocus={focusB} onBlur={blurB} />
                    {editMode && <button onClick={()=>setSavings(p=>p.filter(x=>x.id!==r.id))} style={DB}>✕</button>}
                  </div>
                ))}
                {editMode && <button onClick={()=>setSavings(p=>[...p,{id:uid(),name:"",currency:"EUR",balance:""}])} style={addBtnS(CAT_COLORS.Cash)}>+ ADD ACCOUNT</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── STOCKS ──────────────────────────────────────────────────────── */}
        {(category==="all"||category==="stocks") && (
          <div ref={stocksRef} style={secStyle}>
            <SecHdr label="STOCKS" total={totalStocks} color={CAT_COLORS.Stocks} open={open.stocks} toggle={()=>tog("stocks")} count={stocks.length} cur={currency} />
            <div style={bodyStyle(open.stocks)}>
              <div style={{ padding:"4px 0" }}>
                <div style={{ display:"flex", gap:8, padding:"6px 20px 2px", fontSize:9, color:"#334155", letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif" }}>
                  <span style={{ width:70 }}>TICKER</span><span style={{ flex:1 }}>LABEL</span><span style={{ width:65 }}>SHARES</span><span style={{ width:85 }}>BUY €</span><span style={{ width:85, textAlign:"right" }}>LIVE</span><span style={{ width:65, textAlign:"right" }}>24H</span><span style={{ width:90, textAlign:"right" }}>VALUE</span><span style={{ width:75, textAlign:"right" }}>RETURN</span><span style={{ width:64 }} />{editMode&&<span style={{ width:36 }} />}
                </div>
                {stocks.filter(r=>!search||r.ticker.toLowerCase().includes(search.toLowerCase())||r.label.toLowerCase().includes(search.toLowerCase())).map(r=>{
                  const val=((r.currentPrice??0)*(parseFloat(r.shares)||0));
                  const cost=((parseFloat(r.purchasePrice)||0)*(parseFloat(r.shares)||0));
                  const ret=cost>0?val-cost:null;
                  const retPct=cost>0?((val-cost)/cost)*100:null;
                  return (
                    <div key={r.id} className="nwr" style={rowS}>
                      <input value={r.ticker} onChange={e=>setStocks(p=>p.map(x=>x.id===r.id?{...x,ticker:e.target.value.toUpperCase()}:x))} style={{ ...IS, width:70, fontFamily:"'Orbitron',sans-serif", fontSize:11 }} disabled={!editMode} placeholder="AAPL" onFocus={focusB} onBlur={blurB} />
                      <input value={r.label} onChange={e=>setStocks(p=>p.map(x=>x.id===r.id?{...x,label:e.target.value}:x))} style={{ ...IS, flex:1 }} disabled={!editMode} placeholder="Label…" onFocus={focusB} onBlur={blurB} />
                      <input type="number" value={r.shares} onChange={e=>setStocks(p=>p.map(x=>x.id===r.id?{...x,shares:e.target.value}:x))} style={{ ...IS, width:65 }} disabled={!editMode} placeholder="0" onFocus={focusB} onBlur={blurB} />
                      <input type="number" value={r.purchasePrice} onChange={e=>setStocks(p=>p.map(x=>x.id===r.id?{...x,purchasePrice:e.target.value}:x))} style={{ ...IS, width:85 }} disabled={!editMode} placeholder="0.00" onFocus={focusB} onBlur={blurB} />
                      <div style={{ width:85, textAlign:"right" }}>{r.error?<span style={{ fontSize:10,color:"#f87171" }}>ERR <button onClick={fetchPrices} style={{ background:"none",border:"none",color:"#00e5ff",cursor:"pointer",fontSize:10 }}>↻</button></span>:r.currentPrice==null?<Sk w={70}/>:<span style={{ fontSize:12,color:"#e2e8f0" }}>{fmtCur(r.currentPrice,currency)}</span>}</div>
                      <div style={{ width:65, textAlign:"right" }}>{r.change24h!=null?<span style={{ fontSize:11,color:pc(r.change24h) }}>{fmtPct(r.change24h)}</span>:<Sk w={50}/>}</div>
                      <div style={{ width:90, textAlign:"right", fontSize:12, color:"#e2e8f0" }}>{pv(val)}</div>
                      <div style={{ width:75, textAlign:"right" }}>{ret!=null?<span style={{ fontSize:11,color:pc(ret) }}>{pv(ret)}<br/><span style={{ fontSize:9 }}>{fmtPct(retPct!)}</span></span>:"—"}</div>
                      <Sparkline data={r.sparkline} positive={(r.change24h??0)>=0} />
                      {editMode&&<button onClick={()=>setStocks(p=>p.filter(x=>x.id!==r.id))} style={DB}>✕</button>}
                    </div>
                  );
                })}
                {editMode&&<button onClick={()=>{const id=uid();setStocks(p=>[...p,{id,ticker:"",label:"",shares:"",purchasePrice:"",currentPrice:null,change24h:null,sparkline:[]}]);setTimeout(fetchPrices,500);}} style={addBtnS(CAT_COLORS.Stocks)}>+ ADD STOCK</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── CRYPTO ──────────────────────────────────────────────────────── */}
        {(category==="all"||category==="crypto") && (
          <div ref={cryptoRef} style={secStyle}>
            <SecHdr label="CRYPTO" total={totalCrypto} color={CAT_COLORS.Crypto} open={open.crypto} toggle={()=>tog("crypto")} count={crypto.length} cur={currency} />
            <div style={bodyStyle(open.crypto)}>
              <div style={{ padding:"4px 0" }}>
                <div style={{ display:"flex", gap:8, padding:"6px 20px 2px", fontSize:9, color:"#334155", letterSpacing:"0.1em", fontFamily:"'Orbitron',sans-serif" }}>
                  <span style={{ width:80 }}>COIN</span><span style={{ width:80 }}>AMOUNT</span><span style={{ width:90 }}>AVG BUY</span><span style={{ width:90, textAlign:"right" }}>LIVE</span><span style={{ width:65, textAlign:"right" }}>24H</span><span style={{ width:90, textAlign:"right" }}>VALUE</span><span style={{ width:90, textAlign:"right" }}>RETURN</span><span style={{ width:64 }} /><span style={{ flex:1 }} />{editMode&&<span style={{ width:36 }} />}
                </div>
                {crypto.filter(r=>!search||r.symbol.toLowerCase().includes(search.toLowerCase())||r.label.toLowerCase().includes(search.toLowerCase())).map(r=>{
                  const val=(r.currentPrice??0)*r.totalAmount;
                  const cost=r.avgBuyPrice*r.totalAmount;
                  const ret=cost>0?val-cost:null;
                  const retPct=cost>0?((val-cost)/cost)*100:null;
                  const glAmt=(r.currentPrice!=null)?((r.currentPrice-r.avgBuyPrice)*r.totalAmount):null;
                  const glPct=(r.currentPrice!=null&&r.avgBuyPrice>0)?((r.currentPrice-r.avgBuyPrice)/r.avgBuyPrice)*100:null;
                  return (
                    <div key={r.id}>
                      <div className="nwr" style={rowS}>
                        <div style={{ width:80 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0", fontFamily:"'Orbitron',sans-serif" }}>{r.symbol}</div>
                          <div style={{ fontSize:10, color:"#475569" }}>{r.label}</div>
                        </div>
                        <div style={{ width:80, fontSize:12, color:"#e2e8f0" }}>{r.totalAmount.toFixed(4)}</div>
                        <div style={{ width:90, fontSize:12, color:"#64748b" }}>{fmtCur(r.avgBuyPrice,currency)}</div>
                        <div style={{ width:90, textAlign:"right" }}>{r.error?<span style={{ fontSize:10,color:"#f87171" }}>ERR <button onClick={fetchPrices} style={{ background:"none",border:"none",color:"#00e5ff",cursor:"pointer",fontSize:10 }}>↻</button></span>:r.currentPrice==null?<Sk w={70}/>:<span style={{ fontSize:12,color:"#e2e8f0" }}>{fmtCur(r.currentPrice,currency)}</span>}</div>
                        <div style={{ width:65, textAlign:"right" }}>{r.change24h!=null?<span style={{ fontSize:11,color:pc(r.change24h) }}>{fmtPct(r.change24h)}</span>:<Sk w={50}/>}</div>
                        <div style={{ width:90, textAlign:"right", fontSize:12, color:"#e2e8f0" }}>{pv(val)}</div>
                        <div style={{ width:90, textAlign:"right" }}>{glAmt!=null?<span style={{ fontSize:11,color:pc(glAmt) }}>{pv(glAmt)}<br/><span style={{ fontSize:9 }}>{glPct!=null?fmtPct(glPct):""}</span></span>:"—"}</div>
                        <Sparkline data={r.sparkline} positive={(r.change24h??0)>=0} />
                        <div style={{ flex:1, display:"flex", justifyContent:"flex-end" }}>
                          <button onClick={()=>setCrypto(p=>p.map(x=>x.id===r.id?{...x,showHistory:!x.showHistory}:x))} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:5, padding:"4px 10px", color:"#64748b", fontSize:10, cursor:"pointer" }}>
                            {r.showHistory?"▲ HIDE":"▼ HISTORY"}
                          </button>
                        </div>
                        {editMode&&<button onClick={()=>setCrypto(p=>p.filter(x=>x.id!==r.id))} style={DB}>✕</button>}
                      </div>
                      {/* Transaction History */}
                      {r.showHistory && (
                        <div style={{ background:"rgba(0,0,0,0.2)", borderBottom:"1px solid rgba(255,255,255,0.03)", padding:"10px 20px 14px" }}>
                          <div style={{ fontSize:9, color:"#475569", letterSpacing:"0.12em", fontFamily:"'Orbitron',sans-serif", marginBottom:8 }}>TRANSACTION HISTORY — {r.transactions.length} entries</div>
                          <div style={{ display:"flex", gap:8, fontSize:9, color:"#334155", letterSpacing:"0.1em", marginBottom:6, fontFamily:"'Orbitron',sans-serif" }}>
                            <span style={{ width:100 }}>DATE</span><span style={{ width:80 }}>AMOUNT</span><span style={{ width:100 }}>BUY PRICE</span><span style={{ width:100 }}>VALUE AT BUY</span>
                          </div>
                          {r.transactions.map(tx=>(
                            <div key={tx.id} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom:"1px solid rgba(255,255,255,0.03)", fontSize:12 }}>
                              <span style={{ width:100, color:"#64748b" }}>{tx.date}</span>
                              <span style={{ width:80, color:"#e2e8f0" }}>{tx.amount.toFixed(4)}</span>
                              <span style={{ width:100, color:"#94a3b8" }}>{fmtCur(tx.buyPrice,currency)}</span>
                              <span style={{ width:100, color:"#64748b" }}>{fmtCur(tx.amount*tx.buyPrice,currency)}</span>
                              {editMode && <button onClick={()=>{ const newTxs=r.transactions.filter(t=>t.id!==tx.id); const newTotal=newTxs.reduce((s,t)=>s+t.amount,0); const newAvg=newTotal>0?newTxs.reduce((s,t)=>s+t.amount*t.buyPrice,0)/newTotal:0; setCrypto(p=>p.map(x=>x.id===r.id?{...x,transactions:newTxs,totalAmount:newTotal,avgBuyPrice:newAvg}:x)); }} style={{ ...DB, padding:"2px 8px", fontSize:10 }}>✕</button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ padding:"10px 20px", borderTop:"1px solid rgba(255,255,255,0.03)" }}>
                  <button onClick={()=>setShowTxModal(true)} style={{ background:"rgba(251,191,36,0.06)", border:"1px dashed rgba(251,191,36,0.3)", borderRadius:8, padding:"9px 18px", color:"#fbbf24", fontFamily:"'Orbitron',sans-serif", fontSize:10, letterSpacing:"0.12em", cursor:"pointer" }}>
                    + ADD TRANSACTION
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OTHER ASSETS ────────────────────────────────────────────────── */}
        {category==="all" && (
          <div style={secStyle}>
            <SecHdr label="OTHER ASSETS" total={totalOther} color="#a78bfa" open={open.other} toggle={()=>tog("other")} count={other.length} cur={currency} />
            <div style={bodyStyle(open.other)}>
              <div style={{ padding:"4px 0" }}>
                {other.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())).map(r=>(
                  <div key={r.id} className="nwr" style={rowS}>
                    <input value={r.name} onChange={e=>setOther(p=>p.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} style={{ ...IS, flex:1 }} disabled={!editMode} placeholder="e.g. Apartment, Car…" onFocus={focusB} onBlur={blurB} />
                    <input type="number" value={r.value} onChange={e=>setOther(p=>p.map(x=>x.id===r.id?{...x,value:e.target.value}:x))} style={{ ...IS, width:140, textAlign:"right" }} disabled={!editMode} placeholder="0.00" onFocus={focusB} onBlur={blurB} />
                    {editMode&&<button onClick={()=>setOther(p=>p.filter(x=>x.id!==r.id))} style={DB}>✕</button>}
                  </div>
                ))}
                {editMode&&<button onClick={()=>setOther(p=>[...p,{id:uid(),name:"",value:""}])} style={addBtnS("#a78bfa")}>+ ADD ASSET</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── LIABILITIES ─────────────────────────────────────────────────── */}
        {category==="all" && (
          <div style={secStyle}>
            <SecHdr label="LIABILITIES" total={totalLiabilities} color="#f87171" open={open.liabilities} toggle={()=>tog("liabilities")} count={liabilities.length} cur={currency} />
            <div style={bodyStyle(open.liabilities)}>
              <div style={{ padding:"4px 0" }}>
                {liabilities.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())).map(r=>(
                  <div key={r.id} className="nwr" style={rowS}>
                    <input value={r.name} onChange={e=>setLiabilities(p=>p.map(x=>x.id===r.id?{...x,name:e.target.value}:x))} style={{ ...IS, flex:1 }} disabled={!editMode} placeholder="e.g. Mortgage…" onFocus={focusB} onBlur={blurB} />
                    <input type="number" value={r.amount} onChange={e=>setLiabilities(p=>p.map(x=>x.id===r.id?{...x,amount:e.target.value}:x))} style={{ ...IS, width:140, textAlign:"right", color:"#f87171" }} disabled={!editMode} placeholder="0.00" onFocus={focusB} onBlur={blurB} />
                    {editMode&&<button onClick={()=>setLiabilities(p=>p.filter(x=>x.id!==r.id))} style={DB}>✕</button>}
                  </div>
                ))}
                {editMode&&<button onClick={()=>setLiabilities(p=>[...p,{id:uid(),name:"",amount:""}])} style={addBtnS("#f87171")}>+ ADD LIABILITY</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD ─────────────────────────────────────────────────── */}
        <div style={secStyle}>
          <SecHdr label="PERFORMANCE LEADERBOARD" total={0} color="#00e5ff" open={open.leaderboard} toggle={()=>tog("leaderboard")} count={leaderboard.length} cur={currency} />
          <div style={bodyStyle(open.leaderboard)}>
            <div style={{ padding:"4px 0" }}>
              {leaderboard.length===0?(
                <div style={{ padding:"24px", textAlign:"center", color:"#334155", fontSize:12 }}>Add stocks or crypto with purchase prices to see rankings.</div>
              ):leaderboard.map((a,i)=>(
                <div key={a.name} className="nwr" style={{ ...rowS, gap:16 }}>
                  <span style={{ width:28, fontFamily:"'Orbitron',sans-serif", fontSize:13, fontWeight:800, color:i===0?"#fbbf24":i===1?"#94a3b8":i===2?"#fb923c":"#334155" }}>#{i+1}</span>
                  <span style={{ flex:1, fontSize:13, color:"#e2e8f0" }}>{a.name}</span>
                  <span style={{ fontSize:12, color:a.returnPct>=0?"#4ade80":"#f87171", fontWeight:600, width:70, textAlign:"right" }}>{fmtPct(a.returnPct)}</span>
                  <span style={{ fontSize:12, color:"#64748b", width:100, textAlign:"right" }}>{pv(a.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </main>
      <Footer />

      {/* Transaction Modal */}
      {showTxModal && (
        <AddTxModal
          existingCoins={crypto.map(c=>c.coinId)}
          onConfirm={addTransaction}
          onClose={()=>setShowTxModal(false)}
          cur={currency}
        />
      )}
    </div>
  );
}
