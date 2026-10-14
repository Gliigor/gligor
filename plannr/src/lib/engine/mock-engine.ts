// Prototype calculation engine. Deterministic, simplified, and NOT suitable
// for real advice. Only reachable through calculatePlan() in ./index.ts.

import { ASSUMPTIONS, SCENARIO_KEYS, type ScenarioKey } from "./assumptions";
import type { PlanInput, PlanResult, ProjectionPoint, TaxLine } from "./types";

type Bracket = { readonly upTo: number | null; readonly rate: number };

export function progressiveTax(amount: number, brackets: readonly Bracket[]): number {
  let remaining = Math.max(0, amount);
  let lower = 0;
  let tax = 0;
  for (const b of brackets) {
    const width = b.upTo === null ? remaining : Math.max(0, Math.min(remaining, b.upTo - lower));
    tax += width * b.rate;
    remaining -= width;
    if (b.upTo !== null) lower = b.upTo;
    if (remaining <= 0) break;
  }
  return tax;
}

/** Rate that applies to the next euro of `amount`. */
export function marginalRate(amount: number, brackets: readonly Bracket[]): number {
  for (const b of brackets) {
    if (b.upTo === null || amount < b.upTo) return b.rate;
  }
  return brackets[brackets.length - 1]?.rate ?? 0;
}

export function box3Tax(assets: { savings: number; other: number; debts: number }) {
  const a = ASSUMPTIONS.box3;
  const debtsAboveThreshold = Math.max(0, assets.debts - a.schuldenDrempel);
  const base = Math.max(0, assets.savings + assets.other - debtsAboveThreshold);
  const deemedReturn = Math.max(
    0,
    assets.savings * a.forfaitBanktegoeden + assets.other * a.forfaitOverigeBezittingen - debtsAboveThreshold * a.forfaitSchulden,
  );
  const taxableBase = Math.max(0, base - a.heffingsvrijVermogen);
  const effectiveReturn = base > 0 ? deemedReturn / base : 0;
  const tax = taxableBase * effectiveReturn * a.tarief;
  return { base, deemedReturn, taxableBase, tax };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mockCalculate(input: PlanInput): PlanResult {
  const s = input.scope;
  const warnings: string[] = [];

  // --- Wealth -------------------------------------------------------------
  const woning = s.eigenWoning ? input.prive.eigenWoning : null;
  const eigenWoningValue = woning?.wozValue ?? 0;
  const mortgageDebt = woning ? woning.mortgages.reduce((sum, m) => sum + m.amount, 0) : 0;
  const yearlyMortgageInterest = woning ? woning.mortgages.reduce((sum, m) => sum + m.amount * (m.interestRate / 100), 0) : 0;

  const b3 = s.box3 ? input.prive.box3 : { savings: 0, investments: 0, otherRealEstate: 0, debts: 0 };
  const box3Assets = b3.savings + b3.investments + b3.otherRealEstate;

  const anyZakelijk = s.bv || s.balans || s.resultaat || s.pensioenEigenBeheer || s.dividend;
  const companies = anyZakelijk ? input.zakelijk.companies : [];
  const shareValue = companies.reduce((sum, c) => sum + (s.balans ? c.equity : 0) * (c.sharePercentage / 100), 0);
  const equity = s.balans ? companies.reduce((sum, c) => sum + c.equity, 0) : 0;
  const liquidAssets = s.balans ? companies.reduce((sum, c) => sum + c.liquidAssets, 0) : 0;
  const pensionObligation = s.pensioenEigenBeheer ? companies.reduce((sum, c) => sum + c.pensionObligation, 0) : 0;
  const dgaSalary = s.bv ? companies.reduce((sum, c) => sum + c.dgaSalary, 0) : 0;
  const dividendReceived = s.dividend ? companies.reduce((sum, c) => sum + c.dividend * (c.sharePercentage / 100), 0) : 0;
  const retainedEarnings = s.resultaat
    ? companies.reduce((sum, c) => sum + Math.max(0, c.resultAfterTax - (s.dividend ? c.dividend : 0)) * (c.sharePercentage / 100), 0)
    : 0;

  if (anyZakelijk && companies.some((c) => c.sharePercentage > 0 && c.sharePercentage < 5)) {
    warnings.push("Een aandelenbelang onder 5% is geen aanmerkelijk belang; het is in deze indicatie toch in box 2 meegenomen.");
  }

  // --- Taxes ----------------------------------------------------------------
  const grossEmployment = s.inkomen ? input.prive.grossEmploymentIncome : 0;
  const forfait = eigenWoningValue * ASSUMPTIONS.box1.eigenwoningforfait;
  const box1Base = Math.max(0, grossEmployment + dgaSalary + forfait - yearlyMortgageInterest);
  const box1Gross = progressiveTax(grossEmployment + dgaSalary + forfait, ASSUMPTIONS.box1.brackets);
  const box1Tax = Math.max(0, box1Gross - yearlyMortgageInterest * ASSUMPTIONS.box1.hypotheekrenteAftrekTarief);

  const box2Tax = progressiveTax(dividendReceived, ASSUMPTIONS.box2.brackets);

  const box3 = box3Tax({ savings: b3.savings, other: b3.investments + b3.otherRealEstate, debts: b3.debts });

  const eff = (tax: number, base: number) => (base > 0 ? tax / base : 0);
  const lines: TaxLine[] = [
    {
      box: 1,
      label: "Box 1 — werk en woning",
      base: round(box1Base),
      tax: round(box1Tax),
      marginalRate: box1Base > 0 ? marginalRate(grossEmployment + dgaSalary + forfait, ASSUMPTIONS.box1.brackets) : 0,
      effectiveRate: eff(box1Tax, box1Base),
    },
    {
      box: 2,
      label: "Box 2 — aanmerkelijk belang",
      base: round(dividendReceived),
      tax: round(box2Tax),
      marginalRate: dividendReceived > 0 ? marginalRate(dividendReceived, ASSUMPTIONS.box2.brackets) : 0,
      effectiveRate: eff(box2Tax, dividendReceived),
    },
    {
      box: 3,
      label: "Box 3 — sparen en beleggen",
      base: round(box3.taxableBase),
      tax: round(box3.tax),
      marginalRate: box3.taxableBase > 0 ? ASSUMPTIONS.box3.tarief : 0,
      effectiveRate: eff(box3.tax, box3.base),
    },
  ];
  const taxTotal = box1Tax + box2Tax + box3.tax;
  const grossTotal = grossEmployment + dgaSalary + dividendReceived;
  const net = grossTotal - taxTotal;
  const expenses = s.inkomen ? input.prive.yearlyExpenses : 0;
  const balance = s.inkomen ? net - expenses : 0;

  // --- Retirement -------------------------------------------------------------
  const { birthYear, retirementAge } = input.person;
  const retirementYear = birthYear && retirementAge ? birthYear + retirementAge : null;
  const aowPerYear =
    s.pensioen && input.prive.aowSituation ? ASSUMPTIONS.aow[input.prive.aowSituation] : 0;
  const pensionPerYear = s.pensioen ? input.prive.pensionPerYear : 0;
  if (!birthYear) warnings.push("Geboortejaar ontbreekt: de projectie houdt geen rekening met pensionering.");

  // --- Projection -------------------------------------------------------------
  const startPrive = box3Assets - b3.debts;
  const points: ProjectionPoint[] = [];
  const state = Object.fromEntries(
    SCENARIO_KEYS.map((k) => [k, { prive: startPrive, bv: shareValue, house: eigenWoningValue }]),
  ) as Record<ScenarioKey, { prive: number; bv: number; house: number }>;

  for (let t = 0; t <= ASSUMPTIONS.projectionYears; t++) {
    const year = input.referenceYear + t;
    const age = birthYear ? year - birthYear : null;
    const priceIndex = Math.pow(1 + ASSUMPTIONS.inflation, t);
    const retired = retirementYear !== null && year >= retirementYear;
    const totals = {} as Record<ScenarioKey, number>;

    for (const key of SCENARIO_KEYS) {
      const st = state[key];
      if (t > 0) {
        const r = ASSUMPTIONS.scenarios[key].returnRate;
        // Private wealth: return minus box 3 tax, plus yearly surplus or minus shortfall.
        const tax = box3Tax({ savings: Math.max(0, st.prive) * 0.3, other: Math.max(0, st.prive) * 0.7, debts: 0 }).tax;
        let cashflow = 0;
        if (s.inkomen) {
          if (!retired) {
            cashflow = balance * priceIndex;
          } else {
            const pensionerIncome = pensionPerYear + (age !== null && age >= ASSUMPTIONS.aow.age ? aowPerYear : 0);
            const netPension = pensionerIncome * (1 - ASSUMPTIONS.box1.pensionerRate);
            cashflow = (netPension + (s.dividend ? dividendReceived - box2Tax : 0)) * priceIndex - expenses * priceIndex;
          }
        }
        st.prive = st.prive * (1 + r) - tax + cashflow;
        // BV: retained earnings while working, plus a modest return on liquid assets.
        st.bv = st.bv + (retired ? 0 : retainedEarnings) + liquidAssets * r * ASSUMPTIONS.bv.returnOnLiquidAssetsFactor;
        st.house = st.house * (1 + ASSUMPTIONS.houseValueGrowth);
      }
      const houseNet = s.eigenWoning ? st.house - mortgageDebt : 0;
      totals[key] = round(st.prive + st.bv + houseNet);
    }

    points.push({
      year,
      age,
      pessimistisch: totals.pessimistisch,
      neutraal: totals.neutraal,
      optimistisch: totals.optimistisch,
      neutraalReeel: round(totals.neutraal / priceIndex),
    });
  }

  if (points.some((p) => p.neutraal < 0)) {
    warnings.push("In het neutrale scenario raakt het vermogen binnen de projectieperiode uitgeput.");
  }

  const priveTotal = eigenWoningValue - mortgageDebt + box3Assets - b3.debts;

  return {
    engine: {
      name: "Plannr prototype-rekenkern",
      version: "0.1.0",
      isPrototype: true,
      assumptionsLabel: ASSUMPTIONS.label,
    },
    referenceYear: input.referenceYear,
    wealth: {
      prive: {
        eigenWoningValue: round(eigenWoningValue),
        mortgageDebt: round(mortgageDebt),
        eigenWoningNet: round(eigenWoningValue - mortgageDebt),
        box3Assets: round(box3Assets),
        box3Debts: round(b3.debts),
        box3Net: round(box3Assets - b3.debts),
        total: round(priveTotal),
      },
      zakelijk: {
        shareValue: round(shareValue),
        equity: round(equity),
        liquidAssets: round(liquidAssets),
        pensionObligation: round(pensionObligation),
        total: round(shareValue),
        companies: companies.map((c) => ({
          name: c.name,
          sharePercentage: c.sharePercentage,
          resultAfterTax: s.resultaat ? c.resultAfterTax : 0,
          dividend: s.dividend ? c.dividend : 0,
          dgaSalary: s.bv ? c.dgaSalary : 0,
        })),
      },
      total: round(priveTotal + shareValue),
    },
    income: {
      grossEmployment: round(grossEmployment),
      dgaSalary: round(dgaSalary),
      dividendReceived: round(dividendReceived),
      grossTotal: round(grossTotal),
      taxTotal: round(taxTotal),
      net: round(net),
      expenses: round(expenses),
      balance: round(balance),
    },
    taxes: {
      lines,
      total: round(taxTotal),
      effectiveRate: grossTotal > 0 ? taxTotal / grossTotal : 0,
      box3: {
        base: round(box3.base),
        deemedReturn: round(box3.deemedReturn),
        exemption: ASSUMPTIONS.box3.heffingsvrijVermogen,
        taxableBase: round(box3.taxableBase),
      },
    },
    retirement: { retirementYear, aowPerYear, pensionPerYear: round(pensionPerYear) },
    projection: {
      scenarios: {
        pessimistisch: { ...ASSUMPTIONS.scenarios.pessimistisch },
        neutraal: { ...ASSUMPTIONS.scenarios.neutraal },
        optimistisch: { ...ASSUMPTIONS.scenarios.optimistisch },
      },
      points,
    },
    warnings,
  };
}
