import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "fire_calculator_v1";
const BUDGET_KEY  = "budget_maker_v1";

const FIRE_TYPES = [
  {
    id: "lean",
    label: "Lean FIRE",
    color: "#4ade80",
    desc: "Frugal lifestyle. Cover bare essentials, achieve freedom early. Typically <€25k/yr spending.",
    multiplier: 0.75,
  },
  {
    id: "regular",
    label: "Regular FIRE",
    color: "#60a5fa",
    desc: "Comfortable lifestyle matching your current spending. The classic FIRE target.",
    multiplier: 1.0,
  },
  {
    id: "fat",
    label: "Fat FIRE",
    color: "#fbbf24",
    desc: "Generous budget, no lifestyle compromises. Typically 1.5× your current spending.",
    multiplier: 1.5,
  },
  {
    id: "coast",
    label: "Coast FIRE",
    color: "#a78bfa",
    desc: "Stop contributing today — let compound growth carry you. Work optional for living expenses only.",
    multiplier: 1.0,
  },
  {
    id: "barista",
    label: "Barista FIRE",
    color: "#94a3b8",
    desc: "Semi-retire with part-time income covering some expenses. Smaller portfolio needed.",
    multiplier: 1.0,
  },
] as const;

type FireTypeId = typeof FIRE_TYPES[number]["id"];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Inputs {
  currentAge: number;
  retirementAge: number;
  currentPortfolio: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlyContribution: number;
  annualReturn: number;
  inflation: number;
  box3Tax: boolean;
  swr: number;
  customSwr: number;
  fireType: FireTypeId;
  baristaIncome: number;
  showLean: boolean;
  showRegular: boolean;
  showFat: boolean;
  showCoast: boolean;
  whatIfSliderType: "saving" | "investing";
  whatIfSliderValue: number;
}

const DEFAULT_INPUTS: Inputs = {
  currentAge: 30,
  retirementAge: 50,
  currentPortfolio: 50000,
  monthlyIncome: 4000,
  monthlyExpenses: 2500,
  monthlyContribution: 1000,
  annualReturn: 7,
  inflation: 2.5,
  box3Tax: true,
  swr: 4,
  customSwr: 4,
  fireType: "regular",
  baristaIncome: 800,
  showLean: true,
  showRegular: true,
  showFat: true,
  showCoast: false,
  whatIfSliderType: "saving",
  whatIfSliderValue: 500,
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const fmtK = (n: number) =>
  n >= 1000000 ? `€${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `€${(n / 1000).toFixed(0)}k` : fmt(n);

// ─── Core FIRE Math ───────────────────────────────────────────────────────────
function getEffectiveReturn(annualReturn: number, inflation: number, box3: boolean): number {
  const nominal = annualReturn / 100;
  const inf = inflation / 100;
  const real = (1 + nominal) / (1 + inf) - 1;
  const box3Drag = box3 ? 0.36 * 0.0617 : 0;
  return real - box3Drag;
}

function calcYearsToFire(
  currentPortfolio: number,
  monthlyContribution: number,
  fireNumber: number,
  effectiveReturn: number,
): number {
  if (fireNumber <= currentPortfolio) return 0;
  const r = effectiveReturn / 12;
  if (Math.abs(r) < 0.0001) {
    if (monthlyContribution <= 0) return Infinity;
    return (fireNumber - currentPortfolio) / monthlyContribution / 12;
  }
  // Binary search in months
  let lo = 0, hi = 1200;
  for (let i = 0; i < 120; i++) {
    const mid = (lo + hi) / 2;
    const fv = currentPortfolio * Math.pow(1 + r, mid) +
      monthlyContribution * (Math.pow(1 + r, mid) - 1) / r;
    if (fv < fireNumber) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2 / 12;
}

function calcCoastNumber(fireNumber: number, effectiveReturn: number, yearsLeft: number): number {
  if (yearsLeft <= 0) return fireNumber;
  return fireNumber / Math.pow(1 + effectiveReturn, yearsLeft);
}

function calcPortfolioAtYear(
  current: number,
  monthlyContrib: number,
  effectiveReturn: number,
  years: number,
): number {
  const r = effectiveReturn / 12;
  const n = years * 12;
  if (Math.abs(r) < 0.0001) return current + monthlyContrib * n;
  return current * Math.pow(1 + r, n) + monthlyContrib * (Math.pow(1 + r, n) - 1) / r;
}

function buildChartData(
  inputs: Inputs,
  effectiveReturn: number,
  fireNumbers: Record<string, number>,
  maxYears: number,
) {
  const data = [];
  for (let y = 0; y <= maxYears; y++) {
    const portfolio = calcPortfolioAtYear(inputs.currentPortfolio, inputs.monthlyContribution, effectiveReturn, y);
    data.push({
      year: inputs.currentAge + y,
      portfolio: Math.round(portfolio),
      leanFire:    Math.round(fireNumbers.lean),
      regularFire: Math.round(fireNumbers.regular),
      fatFire:     Math.round(fireNumbers.fat),
      coastFire:   Math.round(fireNumbers.coast),
    });
  }
  return data;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(5,8,15,0.97)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 10, padding: "12px 16px", fontFamily: "'Exo 2',sans-serif", fontSize: 12, minWidth: 170 }}>
      <div style={{ color: "#475569", marginBottom: 8, fontSize: 10, letterSpacing: "0.15em" }}>AGE {label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ color: p.color, fontSize: 11 }}>{p.name}</span>
          <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const SectionLabel = ({ label }: { label: string }) => (
  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10, marginTop: 18, paddingBottom: 5, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
    {label}
  </div>
);

const NumInput = ({ label, value, onChange, prefix, suffix, min, step, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  prefix?: string; suffix?: string; min?: number; step?: number; hint?: string;
}) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: "block", fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</label>
    <div style={{ display: "flex", alignItems: "center", background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 7, overflow: "hidden" }}>
      {prefix && <span style={{ padding: "9px 11px", color: "#334155", fontSize: 12, borderRight: "1px solid rgba(255,255,255,0.04)" }}>{prefix}</span>}
      <input
        type="number" value={value} min={min ?? 0} step={step ?? 1}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        style={{ flex: 1, background: "transparent", border: "none", padding: "9px 11px", color: "#e2e8f0", fontFamily: "inherit", fontSize: 13, outline: "none" }}
      />
      {suffix && <span style={{ padding: "9px 11px", color: "#334155", fontSize: 10, borderLeft: "1px solid rgba(255,255,255,0.04)" }}>{suffix}</span>}
    </div>
    {hint && <div style={{ fontSize: 10, color: "#1e293b", marginTop: 3 }}>{hint}</div>}
  </div>
);

const RangeInput = ({ label, value, min, max, step, onChange, display }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; display: string;
}) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontSize: 12, color: "#00e5ff", fontWeight: 600 }}>{display}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(parseFloat(e.target.value))}
      style={{ width: "100%", cursor: "pointer", accentColor: "#00e5ff" }} />
    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
      <span style={{ fontSize: 9, color: "#1e293b" }}>{min}{typeof display === "string" && display.includes("%") ? "%" : ""}</span>
      <span style={{ fontSize: 9, color: "#1e293b" }}>{max}{typeof display === "string" && display.includes("%") ? "%" : ""}</span>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FireCalculator() {
  const [inputs, setInputs] = useState<Inputs>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) return { ...DEFAULT_INPUTS, ...JSON.parse(s) };
    } catch {}
    return DEFAULT_INPUTS;
  });

  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [bridgeImported, setBridgeImported] = useState(false);
  const [infoOpen, setInfoOpen] = useState<FireTypeId | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs)); } catch {}
  }, [inputs]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (raw) { const d = JSON.parse(raw); if (d.income || d.expenses) setBridgeAvailable(true); }
    } catch {}
  }, []);

  const set = useCallback(<K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setInputs(p => ({ ...p, [k]: v })), []);

  const importBudget = () => {
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const inc  = (d.income ?? []).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0);
      const exp  = (d.expenses ?? []).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0);
      const subs = (d.subscriptions ?? []).reduce((s: number, r: any) => s + (parseFloat(r.amount) || 0), 0);
      if (inc > 0) set("monthlyIncome", Math.round(inc));
      if (exp + subs > 0) {
        set("monthlyExpenses", Math.round(exp + subs));
        set("monthlyContribution", Math.max(0, Math.round(inc - exp - subs)));
      }
      setBridgeImported(true);
      setBridgeAvailable(false);
    } catch {}
  };

  // ── Derived calculations ────────────────────────────────────────────────────
  const effectiveReturn = useMemo(
    () => getEffectiveReturn(inputs.annualReturn, inputs.inflation, inputs.box3Tax),
    [inputs.annualReturn, inputs.inflation, inputs.box3Tax]
  );

  const swrVal = inputs.swr === 0 ? inputs.customSwr / 100 : inputs.swr / 100;
  const activeType = FIRE_TYPES.find(f => f.id === inputs.fireType)!;

  const retirementAnnual = inputs.monthlyExpenses * 12 * activeType.multiplier;
  const adjustedAnnual = inputs.fireType === "barista"
    ? Math.max(0, retirementAnnual - inputs.baristaIncome * 12)
    : retirementAnnual;

  const regularFireNumber = adjustedAnnual / swrVal;
  const yearsLeft = inputs.retirementAge - inputs.currentAge;

  const coastNumber = useMemo(
    () => calcCoastNumber(inputs.monthlyExpenses * 12 / swrVal, effectiveReturn, yearsLeft),
    [inputs.monthlyExpenses, swrVal, effectiveReturn, yearsLeft]
  );

  const displayFireNumber = inputs.fireType === "coast" ? coastNumber : regularFireNumber;

  const years = useMemo(
    () => calcYearsToFire(inputs.currentPortfolio, inputs.monthlyContribution, displayFireNumber, effectiveReturn),
    [inputs.currentPortfolio, inputs.monthlyContribution, displayFireNumber, effectiveReturn]
  );

  const fireYear = new Date().getFullYear() + Math.ceil(years);
  const fireAge  = inputs.currentAge + years;
  const savingsRate = inputs.monthlyIncome > 0 ? (inputs.monthlyContribution / inputs.monthlyIncome) * 100 : 0;
  const progressPct = Math.min(100, (inputs.currentPortfolio / Math.max(1, displayFireNumber)) * 100);

  const fireNumbers = useMemo(() => ({
    lean:    (inputs.monthlyExpenses * 12 * 0.75) / swrVal,
    regular: (inputs.monthlyExpenses * 12 * 1.00) / swrVal,
    fat:     (inputs.monthlyExpenses * 12 * 1.50) / swrVal,
    coast:   coastNumber,
  }), [inputs.monthlyExpenses, swrVal, coastNumber]);

  // What-if
  const whatIfContrib = inputs.whatIfSliderType === "saving"
    ? inputs.monthlyContribution + inputs.whatIfSliderValue : inputs.monthlyContribution;
  const whatIfReturnRate = inputs.whatIfSliderType === "investing"
    ? inputs.annualReturn + (inputs.whatIfSliderValue / 100) : inputs.annualReturn;
  const whatIfEffReturn = getEffectiveReturn(whatIfReturnRate, inputs.inflation, inputs.box3Tax);
  const whatIfYears = useMemo(
    () => calcYearsToFire(inputs.currentPortfolio, whatIfContrib, displayFireNumber, whatIfEffReturn),
    [inputs.currentPortfolio, whatIfContrib, displayFireNumber, whatIfEffReturn]
  );
  const yearsDelta = years - whatIfYears;

  // Chart
  const maxChartYears = Math.min(55, Math.max(30, Math.ceil(years) + 8));
  const chartData = useMemo(
    () => buildChartData(inputs, effectiveReturn, fireNumbers, maxChartYears),
    [inputs, effectiveReturn, fireNumbers, maxChartYears]
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background relative" style={{ fontFamily: "'Exo 2',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600&family=Orbitron:wght@600;700;800&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e293b;border-radius:3px}
        input[type=range]{-webkit-appearance:none;height:3px;background:rgba(0,229,255,0.12);border-radius:2px;width:100%}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#00e5ff;cursor:pointer;box-shadow:0 0 8px rgba(0,229,255,0.5)}
        input[type=number]::-webkit-inner-spin-button{opacity:0}
        .fire-card{background:rgba(255,255,255,0.018);border:1px solid rgba(255,255,255,0.06);border-radius:12px}
        .fire-type-row{transition:all 0.18s;cursor:pointer;border-radius:8px;padding:9px 12px;border:1px solid transparent;display:flex;align-items:flex-start;gap:10px}
        .fire-type-row:hover{background:rgba(255,255,255,0.025)}
        .fire-type-row.active{border-color:rgba(0,229,255,0.25);background:rgba(0,229,255,0.035)}
        .toggle-bar{display:inline-flex;background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.06);border-radius:20px;padding:3px}
        .toggle-opt{padding:5px 14px;border-radius:16px;font-size:10px;letter-spacing:0.1em;cursor:pointer;transition:all 0.2s;border:none;background:transparent;color:#475569;font-family:inherit}
        .toggle-opt.on{background:rgba(0,229,255,0.15);color:#00e5ff}
        .result-gradient{font-family:'Orbitron',sans-serif;font-weight:800;background:linear-gradient(135deg,#00e5ff,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .check-box{width:14px;height:14px;border-radius:3px;border:1px solid rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.18s;flex-shrink:0}
        .pulse{width:6px;height:6px;border-radius:50%;background:#00e5ff;box-shadow:0 0 8px #00e5ff;animation:pk 2s ease-in-out infinite}
        @keyframes pk{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
        .insight-box{background:rgba(0,0,0,0.3);border-radius:8px;padding:12px 14px}
        .whatif-box{background:linear-gradient(135deg,rgba(0,229,255,0.04),rgba(96,165,250,0.04));border:1px solid rgba(0,229,255,0.13);border-radius:10px;padding:14px 16px}
        @media(max-width:1100px){.fire-grid{grid-template-columns:300px 1fr !important}}
        @media(max-width:900px){.fire-grid{grid-template-columns:1fr !important}.right-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}}
        @media(max-width:600px){.right-col{grid-template-columns:1fr !important}.cmp-grid{grid-template-columns:1fr 1fr !important}}
      `}</style>

      <ConstellationBackground />
      <Header />

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16">

        {/* Title */}
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Finance Tool</p>
          <h1 style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "clamp(24px,4vw,38px)", fontWeight: 800, color: "#e2e8f0", marginBottom: 12 }}>
            FIRE Calculator
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            Financial Independence, Retire Early. Find your number, plot your path, pull the levers.
          </p>
        </div>

        {/* Budget Bridge Banner */}
        {bridgeAvailable && (
          <div style={{ background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: 10, padding: "14px 20px", marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: "#fbbf24", fontFamily: "'Orbitron',sans-serif", letterSpacing: "0.1em", marginBottom: 3 }}>💡 BUDGET MAKER DATA FOUND</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>Import your income and expenses automatically.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={importBudget} style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6, padding: "8px 16px", color: "#fbbf24", fontFamily: "'Orbitron',sans-serif", fontSize: 10, cursor: "pointer", letterSpacing: "0.1em" }}>IMPORT</button>
              <button onClick={() => setBridgeAvailable(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 6, padding: "8px 16px", color: "#334155", fontFamily: "'Orbitron',sans-serif", fontSize: 10, cursor: "pointer" }}>DISMISS</button>
            </div>
          </div>
        )}
        {bridgeImported && (
          <div style={{ background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.18)", borderRadius: 10, padding: "12px 20px", marginBottom: 24, fontSize: 12, color: "#4ade80" }}>
            ✓ Income and expenses imported from Budget Maker
          </div>
        )}

        {/* Main Grid */}
        <div className="fire-grid" style={{ display: "grid", gridTemplateColumns: "310px 1fr 290px", gap: 18, alignItems: "start" }}>

          {/* ── LEFT PANEL: Inputs ────────────────────────────────────────── */}
          <div className="fire-card" style={{ padding: 22, position: "sticky", top: 20 }}>
            <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.22em", marginBottom: 16 }}>YOUR SITUATION</div>

            {/* FIRE Type */}
            <SectionLabel label="FIRE Type" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {FIRE_TYPES.map(ft => (
                <div key={ft.id}>
                  <div className={`fire-type-row ${inputs.fireType === ft.id ? "active" : ""}`}
                    onClick={() => set("fireType", ft.id)}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: ft.color, marginTop: 4, flexShrink: 0, boxShadow: inputs.fireType === ft.id ? `0 0 7px ${ft.color}` : "none", transition: "box-shadow 0.2s" }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 12, color: inputs.fireType === ft.id ? "#e2e8f0" : "#64748b", fontWeight: inputs.fireType === ft.id ? 600 : 400 }}>{ft.label}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setInfoOpen(infoOpen === ft.id ? null : ft.id); }}
                      style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 11, padding: "0 4px", lineHeight: 1 }}>ⓘ</button>
                  </div>
                  {infoOpen === ft.id && (
                    <div style={{ fontSize: 11, color: "#475569", padding: "6px 12px 6px 20px", lineHeight: 1.55, background: "rgba(0,0,0,0.2)", borderRadius: "0 0 6px 6px", marginTop: -2 }}>
                      {ft.desc}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {inputs.fireType === "barista" && (
              <div style={{ marginTop: 10 }}>
                <NumInput label="PART-TIME MONTHLY INCOME" value={inputs.baristaIncome} onChange={v => set("baristaIncome", v)} prefix="€" hint="Bridge income that reduces your portfolio target" />
              </div>
            )}

            {/* Personal */}
            <SectionLabel label="Personal" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <NumInput label="CURRENT AGE" value={inputs.currentAge} onChange={v => set("currentAge", v)} min={16} />
              <NumInput label="TARGET AGE" value={inputs.retirementAge} onChange={v => set("retirementAge", v)} min={inputs.currentAge + 1} />
            </div>
            <NumInput label="CURRENT PORTFOLIO" value={inputs.currentPortfolio} onChange={v => set("currentPortfolio", v)} prefix="€" hint="All invested assets combined" />

            {/* Cash Flow */}
            <SectionLabel label="Monthly Cash Flow" />
            <NumInput label="NET MONTHLY INCOME" value={inputs.monthlyIncome} onChange={v => set("monthlyIncome", v)} prefix="€" />
            <NumInput label="RETIREMENT MONTHLY EXPENSES" value={inputs.monthlyExpenses} onChange={v => set("monthlyExpenses", v)} prefix="€" hint="What you'll actually spend in retirement" />
            <NumInput label="MONTHLY INVESTMENT" value={inputs.monthlyContribution} onChange={v => set("monthlyContribution", v)} prefix="€" hint="Amount invested/saved each month" />

            {/* Live savings rate */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 13px", background: "rgba(0,229,255,0.035)", border: "1px solid rgba(0,229,255,0.1)", borderRadius: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#334155", letterSpacing: "0.12em" }}>SAVINGS RATE</span>
              <span style={{ fontSize: 17, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: savingsRate >= 40 ? "#4ade80" : savingsRate >= 20 ? "#fbbf24" : "#f87171" }}>
                {savingsRate.toFixed(1)}%
              </span>
            </div>

            {/* Assumptions */}
            <SectionLabel label="Assumptions" />
            <RangeInput label="EXPECTED ANNUAL RETURN" value={inputs.annualReturn} min={1} max={15} step={0.1} onChange={v => set("annualReturn", v)} display={`${inputs.annualReturn.toFixed(1)}%`} />
            <RangeInput label="INFLATION RATE" value={inputs.inflation} min={0} max={8} step={0.1} onChange={v => set("inflation", v)} display={`${inputs.inflation.toFixed(1)}%`} />

            {/* SWR */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em", marginBottom: 7 }}>SAFE WITHDRAWAL RATE</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {[3, 3.5, 4, 0].map(v => (
                  <button key={v} onClick={() => set("swr", v)} style={{
                    padding: "6px 10px", borderRadius: 6, fontSize: 10, cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s",
                    background: inputs.swr === v ? "rgba(0,229,255,0.14)" : "rgba(0,0,0,0.4)",
                    border: inputs.swr === v ? "1px solid rgba(0,229,255,0.38)" : "1px solid rgba(255,255,255,0.06)",
                    color: inputs.swr === v ? "#00e5ff" : "#475569",
                  }}>{v === 0 ? "Custom" : `${v}%`}</button>
                ))}
              </div>
              {inputs.swr === 0 && (
                <div style={{ marginTop: 8 }}>
                  <RangeInput label="CUSTOM SWR" value={inputs.customSwr} min={1} max={8} step={0.1} onChange={v => set("customSwr", v)} display={`${inputs.customSwr.toFixed(1)}%`} />
                </div>
              )}
            </div>

            {/* Box 3 toggle */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" }}>
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Dutch Box 3 Tax</div>
                <div style={{ fontSize: 10, color: "#1e293b", marginTop: 1 }}>~2.22% effective portfolio drag</div>
              </div>
              <div onClick={() => set("box3Tax", !inputs.box3Tax)} style={{
                width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "all 0.2s", position: "relative",
                background: inputs.box3Tax ? "rgba(0,229,255,0.28)" : "rgba(255,255,255,0.07)",
                border: inputs.box3Tax ? "1px solid rgba(0,229,255,0.45)" : "1px solid rgba(255,255,255,0.1)",
              }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, transition: "all 0.2s", position: "absolute", top: 2, left: inputs.box3Tax ? 18 : 2, background: inputs.box3Tax ? "#00e5ff" : "#334155", boxShadow: inputs.box3Tax ? "0 0 6px #00e5ff" : "none" }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#1e293b", marginTop: 5, paddingLeft: 2 }}>
              Effective real return: <span style={{ color: "#475569" }}>{(effectiveReturn * 100).toFixed(2)}%/yr</span>
            </div>

            <button onClick={() => { setInputs(DEFAULT_INPUTS); setBridgeImported(false); }}
              style={{ marginTop: 18, width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 7, padding: "8px", color: "#1e293b", fontFamily: "'Orbitron',sans-serif", fontSize: 9, letterSpacing: "0.15em", cursor: "pointer" }}>
              RESET DEFAULTS
            </button>
          </div>

          {/* ── CENTER PANEL: Results + Chart ─────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Hero card */}
            <div className="fire-card" style={{ padding: 26 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, marginBottom: 22 }}>

                <div>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", marginBottom: 8 }}>
                    {inputs.fireType === "coast" ? "COAST NUMBER" : "FIRE NUMBER"}
                  </div>
                  <div className="result-gradient" style={{ fontSize: "clamp(20px,2.5vw,28px)" }}>
                    {fmtK(displayFireNumber)}
                  </div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 5 }}>
                    {fmt(adjustedAnnual / 12)}/mo · {(swrVal * 100).toFixed(1)}% SWR
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", marginBottom: 8 }}>YEARS TO FIRE</div>
                  <div className="result-gradient" style={{ fontSize: "clamp(20px,2.5vw,28px)" }}>
                    {isFinite(years) ? years.toFixed(1) : "∞"}
                  </div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 5 }}>
                    {isFinite(years) ? `Age ${fireAge.toFixed(1)} · ${fireYear}` : "add contributions"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 9, color: "#334155", letterSpacing: "0.2em", marginBottom: 8 }}>PROGRESS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="52" height="52" viewBox="0 0 52 52" style={{ flexShrink: 0 }}>
                      <circle cx="26" cy="26" r="20" fill="none" stroke="rgba(0,229,255,0.07)" strokeWidth="4.5" />
                      <circle cx="26" cy="26" r="20" fill="none" stroke="#00e5ff" strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPct / 100)}`}
                        transform="rotate(-90 26 26)"
                        style={{ transition: "stroke-dashoffset 0.7s ease", filter: "drop-shadow(0 0 4px #00e5ff)" }}
                      />
                      <text x="26" y="30" textAnchor="middle" fontSize="9" fill="#00e5ff" fontFamily="'Orbitron',sans-serif" fontWeight="700">
                        {progressPct.toFixed(0)}%
                      </text>
                    </svg>
                    <div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtK(inputs.currentPortfolio)}</div>
                      <div style={{ fontSize: 10, color: "#1e293b" }}>of {fmtK(displayFireNumber)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 2, background: "rgba(255,255,255,0.04)", borderRadius: 1, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#00e5ff,#60a5fa)", borderRadius: 1, transition: "width 0.5s ease" }} />
              </div>

              {/* Savings rate badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="pulse" />
                <span style={{ fontSize: 11, color: "#475569" }}>
                  Saving {savingsRate.toFixed(1)}% of income —{" "}
                  <span style={{ color: savingsRate >= 50 ? "#4ade80" : savingsRate >= 30 ? "#fbbf24" : "#f87171" }}>
                    {savingsRate >= 50 ? "exceptional pace" : savingsRate >= 30 ? "solid foundation" : "consider saving more"}
                  </span>
                </span>
              </div>
            </div>

            {/* Coast info strip */}
            {inputs.showCoast && (
              <div style={{ background: "rgba(167,139,250,0.04)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: 10, padding: "13px 18px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                <span style={{ color: "#a78bfa", fontWeight: 600, fontFamily: "'Orbitron',sans-serif", fontSize: 10, letterSpacing: "0.1em" }}>COAST FIRE — </span>
                You need <span style={{ color: "#a78bfa", fontWeight: 600 }}>{fmtK(coastNumber)}</span> invested today to reach FIRE without further contributions.
                {inputs.currentPortfolio >= coastNumber
                  ? <span style={{ color: "#4ade80" }}> ✓ You've already crossed Coast FIRE!</span>
                  : <span> <span style={{ color: "#a78bfa" }}>{fmtK(coastNumber - inputs.currentPortfolio)}</span> to go.</span>}
              </div>
            )}

            {/* Growth Chart */}
            <div className="fire-card" style={{ padding: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", marginBottom: 3 }}>PORTFOLIO GROWTH</div>
                  <div style={{ fontSize: 11, color: "#1e293b" }}>Tick boxes to show/hide FIRE targets</div>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[
                    { key: "showLean",    label: "Lean",    color: "#4ade80" },
                    { key: "showRegular", label: "Regular", color: "#60a5fa" },
                    { key: "showFat",     label: "Fat",     color: "#fbbf24" },
                    { key: "showCoast",   label: "Coast",   color: "#a78bfa" },
                  ].map(({ key, label, color }) => {
                    const checked = (inputs as any)[key];
                    return (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
                        onClick={() => set(key as keyof Inputs, !checked as any)}>
                        <div className="check-box" style={{ background: checked ? color + "30" : "transparent", borderColor: checked ? color : "rgba(255,255,255,0.12)" }}>
                          {checked && <div style={{ width: 6, height: 6, borderRadius: 1, background: color }} />}
                        </div>
                        <span style={{ fontSize: 11, color: checked ? color : "#334155" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ left: 5, right: 16, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.025)" />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#334155", fontFamily: "inherit" }} tickLine={false} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "#334155", fontFamily: "inherit" }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<CustomTooltip />} />

                  <Line dataKey="portfolio" name="Portfolio" stroke="#00e5ff" strokeWidth={2.5} dot={false}
                    style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.45))" }} />
                  {inputs.showLean    && <Line dataKey="leanFire"    name="Lean FIRE"    stroke="#4ade80" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
                  {inputs.showRegular && <Line dataKey="regularFire" name="Regular FIRE" stroke="#60a5fa" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
                  {inputs.showFat     && <Line dataKey="fatFire"     name="Fat FIRE"     stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="6 3" />}
                  {inputs.showCoast   && <Line dataKey="coastFire"   name="Coast FIRE"   stroke="#a78bfa" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />}

                  {isFinite(years) && (
                    <ReferenceLine x={Math.round(inputs.currentAge + years)}
                      stroke="rgba(0,229,255,0.35)" strokeDasharray="3 3"
                      label={{ value: "FIRE", position: "insideTopRight", fill: "#00e5ff", fontSize: 9, fontFamily: "'Orbitron',sans-serif" }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* FIRE type comparison */}
            <div className="fire-card" style={{ padding: 20 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", marginBottom: 16 }}>FIRE TYPE COMPARISON</div>
              <div className="cmp-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {[
                  { label: "Lean",    color: "#4ade80", num: fireNumbers.lean,    id: "lean" },
                  { label: "Regular", color: "#60a5fa", num: fireNumbers.regular, id: "regular" },
                  { label: "Fat",     color: "#fbbf24", num: fireNumbers.fat,     id: "fat" },
                  { label: "Coast",   color: "#a78bfa", num: fireNumbers.coast,   id: "coast" },
                ].map(({ label, color, num, id }) => {
                  const y = calcYearsToFire(inputs.currentPortfolio, inputs.monthlyContribution, num, effectiveReturn);
                  const isActive = inputs.fireType === id;
                  return (
                    <div key={id} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: "11px 13px", border: `1px solid ${isActive ? color + "55" : color + "18"}`, transition: "border-color 0.2s" }}>
                      <div style={{ fontSize: 10, color, marginBottom: 5, letterSpacing: "0.07em" }}>{label}</div>
                      <div style={{ fontSize: 14, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: "#e2e8f0", marginBottom: 4 }}>{fmtK(num)}</div>
                      <div style={{ fontSize: 11, color: "#475569" }}>{isFinite(y) ? `${y.toFixed(1)} yrs` : "∞"}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL: What-if + Insights ──────────────────────────── */}
          <div className="right-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* What-if explorer */}
            <div className="fire-card" style={{ padding: 22 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", marginBottom: 14 }}>WHAT-IF EXPLORER</div>

              <div className="toggle-bar" style={{ marginBottom: 16 }}>
                <button className={`toggle-opt ${inputs.whatIfSliderType === "saving" ? "on" : ""}`}
                  onClick={() => { set("whatIfSliderType", "saving"); set("whatIfSliderValue", 500); }}>
                  + SAVING
                </button>
                <button className={`toggle-opt ${inputs.whatIfSliderType === "investing" ? "on" : ""}`}
                  onClick={() => { set("whatIfSliderType", "investing"); set("whatIfSliderValue", 50); }}>
                  + RETURN
                </button>
              </div>

              {inputs.whatIfSliderType === "saving" ? (
                <RangeInput
                  label="EXTRA MONTHLY SAVINGS"
                  value={inputs.whatIfSliderValue}
                  min={0} max={2000} step={50}
                  onChange={v => set("whatIfSliderValue", v)}
                  display={`+€${inputs.whatIfSliderValue}/mo`}
                />
              ) : (
                <RangeInput
                  label="EXTRA ANNUAL RETURN"
                  value={inputs.whatIfSliderValue}
                  min={0} max={300} step={10}
                  onChange={v => set("whatIfSliderValue", v)}
                  display={`+${(inputs.whatIfSliderValue / 100).toFixed(2)}%`}
                />
              )}

              <div className="whatif-box" style={{ marginTop: 6 }}>
                <div style={{ fontSize: 10, color: "#334155", letterSpacing: "0.1em", marginBottom: 12 }}>
                  {inputs.whatIfSliderType === "saving"
                    ? `If you save €${inputs.whatIfSliderValue} more/month:`
                    : `If returns are +${(inputs.whatIfSliderValue / 100).toFixed(2)}% higher:`}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Years saved</span>
                  <span style={{ fontSize: 20, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: yearsDelta > 0 ? "#4ade80" : "#f87171" }}>
                    {yearsDelta >= 0 ? "−" : "+"}{Math.abs(yearsDelta).toFixed(1)}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>New FIRE age</span>
                  <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                    {isFinite(whatIfYears) ? (inputs.currentAge + whatIfYears).toFixed(1) : "∞"}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
                  <span style={{ fontSize: 11, color: "#64748b" }}>New FIRE year</span>
                  <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                    {isFinite(whatIfYears) ? new Date().getFullYear() + Math.ceil(whatIfYears) : "—"}
                  </span>
                </div>

                {yearsDelta > 1 && (
                  <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#4ade80", lineHeight: 1.5 }}>
                    💡 This single change saves you <strong>{yearsDelta.toFixed(1)} years</strong> of work.
                  </div>
                )}
                {yearsDelta <= 0 && inputs.whatIfSliderValue > 0 && (
                  <div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "#475569" }}>
                    Adjust the slider to see the impact.
                  </div>
                )}
              </div>
            </div>

            {/* Key Insights */}
            <div className="fire-card" style={{ padding: 22 }}>
              <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.2em", marginBottom: 14 }}>KEY INSIGHTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div className="insight-box">
                  <div style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.1em", marginBottom: 4 }}>RETIREMENT MONTHLY SPEND</div>
                  <div style={{ fontSize: 16, color: "#e2e8f0", fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>{fmt(adjustedAnnual / 12)}</div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 2 }}>
                    {inputs.fireType === "barista" ? `after €${inputs.baristaIncome}/mo part-time income` : "inflation-adjusted target"}
                  </div>
                </div>

                <div className="insight-box">
                  <div style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.1em", marginBottom: 4 }}>EFFECTIVE REAL RETURN</div>
                  <div style={{ fontSize: 16, color: effectiveReturn > 0 ? "#60a5fa" : "#f87171", fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>{(effectiveReturn * 100).toFixed(2)}%</div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 2 }}>
                    {inputs.annualReturn}% − {inputs.inflation}% inflation{inputs.box3Tax ? " − Box 3" : ""}
                  </div>
                </div>

                <div className="insight-box">
                  <div style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.1em", marginBottom: 4 }}>PORTFOLIO RUNWAY</div>
                  <div style={{ fontSize: 16, color: "#fbbf24", fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>
                    {adjustedAnnual > 0 ? (displayFireNumber / adjustedAnnual).toFixed(0) : "∞"} years
                  </div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 2 }}>at target spending, no growth</div>
                </div>

                <div className="insight-box">
                  <div style={{ fontSize: 10, color: "#1e293b", letterSpacing: "0.1em", marginBottom: 4 }}>MONTHLY SURPLUS NOW</div>
                  <div style={{ fontSize: 16, fontFamily: "'Orbitron',sans-serif", fontWeight: 700, color: (inputs.monthlyIncome - inputs.monthlyExpenses) >= 0 ? "#4ade80" : "#f87171" }}>
                    {fmt(inputs.monthlyIncome - inputs.monthlyExpenses)}
                  </div>
                  <div style={{ fontSize: 10, color: "#1e293b", marginTop: 2 }}>income − expenses</div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ padding: "13px 15px", background: "rgba(0,0,0,0.18)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 10, color: "#1e293b", lineHeight: 1.6 }}>
                ⚠ Projections assume constant returns. Real markets fluctuate. Not financial advice. Verify Box 3 rates annually — Dutch tax law changes frequently.
              </div>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
