// Prototype calculation engine. Deterministic, simplified, and NOT suitable
// for real advice. Only reachable through calculatePlan() in ./index.ts.
//
// Household model: a client and optionally a partner. Box 1 is calculated per
// person. Fiscal partners may divide box 2 and box 3 freely (we use the most
// favourable split); without fiscal partnership everything follows ownership.

import { ASSUMPTIONS, SCENARIO_KEYS, type ScenarioKey } from "./assumptions";
import type {
  CashFlowItem,
  GiftSummary,
  Owner,
  PersonInput,
  PersonResult,
  PlanInput,
  PlanResult,
  ProjectionPoint,
  TaxLine,
} from "./types";

import { marginalRate, progressiveTax } from "./tax-math";

type Role = "client" | "partner";

export { marginalRate, progressiveTax };

/**
 * Box 3 under the deemed-return system. `allowances` is the number of people
 * whose tax-free allowance and debt threshold apply (2 for fiscal partners).
 */
export function box3Tax(assets: { savings: number; other: number; debts: number }, allowances = 1) {
  const a = ASSUMPTIONS.box3;
  const debtsAboveThreshold = Math.max(0, assets.debts - a.schuldenDrempel * allowances);
  const base = Math.max(0, assets.savings + assets.other - debtsAboveThreshold);
  const deemedReturn = Math.max(
    0,
    assets.savings * a.forfaitBanktegoeden + assets.other * a.forfaitOverigeBezittingen - debtsAboveThreshold * a.forfaitSchulden,
  );
  const exemption = a.heffingsvrijVermogen * allowances;
  const taxableBase = Math.max(0, base - exemption);
  const effectiveReturn = base > 0 ? deemedReturn / base : 0;
  const tax = taxableBase * effectiveReturn * a.tarief;
  return { base, deemedReturn, exemption, taxableBase, tax };
}

/** Box 2 tax on a dividend divided evenly over `people` people (fiscal partners). */
export function box2Tax(dividend: number, people = 1): number {
  const n = Math.max(1, people);
  return progressiveTax(dividend / n, ASSUMPTIONS.box2.brackets) * n;
}

/** Gross extra dividend needed to receive `net` after box 2 tax, on top of an existing dividend. */
export function grossUpDividend(net: number, existing: number, people: number): number {
  if (net <= 0) return 0;
  let lo = net;
  let hi = net * 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const received = mid - (box2Tax(existing + mid, people) - box2Tax(existing, people));
    if (received < net) lo = mid;
    else hi = mid;
  }
  return hi;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function mockCalculate(input: PlanInput): PlanResult {
  const s = input.scope;
  const a = ASSUMPTIONS;
  const warnings: string[] = [];
  const h = input.household;

  const hasPartner = s.partner && h.partner !== null;
  const fiscal = hasPartner && (h.relation === "gehuwd" || h.relation === "samenwonend_fiscaal");
  const people: { role: Role; p: PersonInput }[] = [{ role: "client", p: h.client }];
  if (hasPartner && h.partner) people.push({ role: "partner", p: h.partner });
  const roles = people.map((x) => x.role);

  /** Share of an item that belongs to `role`. */
  const share = (owner: Owner, role: Role): number => {
    if (!hasPartner) return role === "client" ? 1 : 0;
    if (owner === "joint") return 0.5;
    return owner === role ? 1 : 0;
  };

  // --- Wealth -----------------------------------------------------------------------
  const woning = s.eigenWoning ? input.prive.eigenWoning : null;
  const loans = input.prive.loans;
  // A loan from the own BV for the eigen woning is an eigenwoningschuld; other loans from the BV are box 3 debts.
  const homeLoans = loans.filter((l) => l.kind === "lening_dga" && l.forHome && s.eigenWoning);
  const otherBvDebts = loans.filter((l) => l.kind === "lening_dga" && !(l.forHome && s.eigenWoning));
  const tbsLoans = loans.filter((l) => l.kind === "vordering_bv");
  const mortgages = [...(woning?.mortgages ?? []), ...homeLoans.map((l) => ({ amount: l.amount, interestRate: l.interestRate }))];
  const eigenWoningValue = woning?.wozValue ?? 0;
  const mortgageDebt = mortgages.reduce((sum, m) => sum + m.amount, 0);
  const yearlyMortgageInterest = mortgages.reduce((sum, m) => sum + m.amount * (m.interestRate / 100), 0);
  const forfait = eigenWoningValue * a.box1.eigenwoningforfait;

  const box3Items = [
    ...(s.box3 ? input.prive.box3 : []),
    ...otherBvDebts.map((l) => ({ category: "debts" as const, value: l.amount, owner: l.owner })),
  ];
  const sumCat = (cat: string, role?: Role) =>
    box3Items.filter((i) => i.category === cat).reduce((sum, i) => sum + i.value * (role ? share(i.owner, role) : 1), 0);
  const b3 = { savings: sumCat("savings"), investments: sumCat("investments"), otherRealEstate: sumCat("otherRealEstate"), debts: sumCat("debts") };
  const box3Assets = b3.savings + b3.investments + b3.otherRealEstate;

  const anyZakelijk = s.bv || s.balans || s.resultaat || s.pensioenEigenBeheer || s.dividend;
  const companies = (anyZakelijk ? input.zakelijk.companies : []).map((c) => ({
    ...c,
    owner: (c.owner === "partner" && hasPartner ? "partner" : "client") as Role,
  }));
  const pct = (c: { sharePercentage: number }) => c.sharePercentage / 100;
  // A werkmaatschappij held by a holding is not in box 2 itself: its value sits in the holding's
  // deelneming, and its profit (dividend to the holding is tax-free) adds to the group.
  const direct = companies.filter((c) => !c.heldByHolding);
  const shareValue = direct.reduce((sum, c) => sum + (s.balans ? c.equity : 0) * pct(c), 0);
  const equity = s.balans ? companies.reduce((sum, c) => sum + c.equity, 0) : 0;
  const liquidAssets = s.balans ? companies.reduce((sum, c) => sum + c.liquidAssets, 0) : 0;
  const ownLiquid = s.balans ? direct.reduce((sum, c) => sum + c.liquidAssets * pct(c), 0) : 0;
  const pensionObligation = s.pensioenEigenBeheer ? companies.reduce((sum, c) => sum + c.pensionObligation, 0) : 0;
  const dgaSalaryOf = (role: Role) => (s.bv ? companies.filter((c) => c.owner === role).reduce((sum, c) => sum + c.dgaSalary, 0) : 0);
  const dividendOf = (role: Role) => (s.dividend ? direct.filter((c) => c.owner === role).reduce((sum, c) => sum + c.dividend * pct(c), 0) : 0);
  const retainedOf = (role: Role) =>
    s.resultaat
      ? companies
          .filter((c) => c.owner === role)
          .reduce(
            (sum, c) => sum + Math.max(0, c.resultAfterTax - (s.dividend && !c.heldByHolding ? c.dividend : 0)) * pct(c),
            0,
          )
      : 0;

  if (companies.some((c) => c.sharePercentage > 0 && c.sharePercentage < 5)) {
    warnings.push("Een aandelenbelang onder 5% is geen aanmerkelijk belang; het is in deze indicatie toch in box 2 meegenomen.");
  }

  // --- Items over time, policies and loans to the own BV ------------------------------
  const ref = input.referenceYear;
  const indexAt = (t: number) => Math.pow(1 + a.inflation, t);
  const personOf = (role: Role) => people.find((x) => x.role === role)?.p ?? null;
  const items = input.prive.cashItems.filter((it) => it.amount > 0 && (it.person !== "partner" || hasPartner));
  const startOf = (it: CashFlowItem) => {
    if (it.startYear !== null) return it.startYear;
    const p = personOf(it.person ?? "client");
    if (it.startFrom === "pensioen" && p?.birthYear && p.retirementAge) return p.birthYear + p.retirementAge;
    return ref;
  };
  /** Amount of an item in year ref + t, in money of the reference year (0 when not active). */
  const itemReal = (it: CashFlowItem, t: number) => {
    const year = ref + t;
    const start = startOf(it);
    if (year < start || (it.oneOff ? year !== start : it.endYear !== null && year > it.endYear)) return 0;
    if (it.growth === null) return it.amount;
    return (it.amount * Math.pow(1 + it.growth / 100, t)) / indexAt(t);
  };

  // Policies are scenario-independent: they grow at a fixed rate.
  const N = a.projectionYears;
  const policies = input.prive.policies;
  const balances = policies.map((p) => p.value);
  const policyWealth: number[] = [];
  const kewPayout: number[] = [];
  const lijfrenteIn: Record<Role, number>[] = [];
  const lijfrenteOut: Record<Role, number>[] = [];
  for (let t = 0; t <= N; t++) {
    const year = ref + t;
    let wealth = 0;
    let payout = 0;
    const inflow = { client: 0, partner: 0 };
    const outflow = { client: 0, partner: 0 };
    policies.forEach((p, i) => {
      if (p.kind === "spaarrekening_eigen_woning") {
        if (t > 0) balances[i] *= 1 + a.savingsRate;
      } else if (p.kind === "kapitaalverzekering") {
        if (p.payoutYear !== null && year > p.payoutYear) balances[i] = 0;
        else if (t > 0) balances[i] *= 1 + a.policyReturn;
        if (p.payoutYear !== null && year === p.payoutYear) {
          payout += p.expectedPayout ?? balances[i];
          balances[i] = 0;
        }
      } else {
        const start = p.startYear ?? Number.POSITIVE_INFINITY;
        const years = Math.max(1, p.years ?? 20);
        if (t > 0) balances[i] *= 1 + a.policyReturn;
        if (year < start) {
          if (t > 0) balances[i] += p.yearlyContribution;
          for (const r of roles) inflow[r] += p.yearlyContribution * share(p.owner, r);
        } else if (year < start + years && balances[i] > 0) {
          const pay = balances[i] / (start + years - year);
          balances[i] -= pay;
          for (const r of roles) outflow[r] += pay * share(p.owner, r);
        }
      }
      wealth += balances[i];
    });
    policyWealth.push(wealth);
    kewPayout.push(payout);
    lijfrenteIn.push(inflow);
    lijfrenteOut.push(outflow);
  }
  const tbsValue = tbsLoans.reduce((sum, l) => sum + l.amount, 0);
  const tbsInterestOf = (role: Role) => tbsLoans.reduce((sum, l) => sum + l.amount * (l.interestRate / 100) * share(l.owner, role), 0);

  /** Everything the items, policies and TBS loans add for one person in year ref + t (money of the reference year). */
  const flowsAt = (t: number, role: Role) => {
    const mine = items.filter((it) => it.person !== null && it.person === role);
    const sum = (pred: (it: CashFlowItem) => boolean) => mine.filter(pred).reduce((x, it) => x + itemReal(it, t), 0);
    return {
      box1: sum((it) => it.group === "inkomen" && it.tax === "box1") + (lijfrenteOut[t][role] + tbsInterestOf(role)) / indexAt(t),
      taxFree: sum((it) => it.group === "inkomen" && it.tax === "onbelast"),
      deductibleGifts: sum((it) => it.tax === "aftrekbaar"),
      lijfrenteContribution: lijfrenteIn[t][role] / indexAt(t),
    };
  };
  /** All expense items of the household in year ref + t (money of the reference year). */
  const itemExpensesAt = (t: number) => items.filter((it) => it.group === "uitgave").reduce((x, it) => x + itemReal(it, t), 0);
  /** Tax saved by deductible gifts (giftenaftrek), at the limited deduction rate. */
  const giftDeduction = (gifts: number, income: number, rate: number) =>
    Math.min(Math.max(0, gifts - a.giften.drempel * income), a.giften.maximum * income) * rate;

  // Wet excessief lenen: debts to the own BV (not for the eigen woning) above the limit.
  const bvDebtOf = (role: Role) =>
    loans.filter((l) => l.kind === "lening_dga" && !l.forHome).reduce((sum, l) => sum + l.amount * share(l.owner, role), 0);
  const bvDebtTotal = loans.filter((l) => l.kind === "lening_dga").reduce((sum, l) => sum + l.amount, 0);
  const bvExcess = fiscal
    ? Math.max(0, roles.reduce((x, r) => x + bvDebtOf(r), 0) - a.bv.excessiefLenenGrens)
    : roles.reduce((x, r) => x + Math.max(0, bvDebtOf(r) - a.bv.excessiefLenenGrens), 0);
  if (bvExcess > 0) {
    warnings.push(
      "De schulden aan de eigen BV liggen boven de grens van de Wet excessief lenen. Het meerdere wordt eenmalig als inkomen in box 2 belast; dat is in deze indicatie niet doorgerekend.",
    );
  }

  // --- Eigen woning allocation ------------------------------------------------------
  const employmentOf = (role: Role) => (s.inkomen ? (people.find((x) => x.role === role)?.p.grossEmploymentIncome ?? 0) : 0);
  const ewShare: Record<Role, number> = { client: 0, partner: 0 };
  if (woning || mortgages.length > 0) {
    if (fiscal) {
      // Fiscal partners may allocate the eigen woning freely: put it with the higher income.
      const income = (r: Role) => employmentOf(r) + dgaSalaryOf(r);
      const top = roles.reduce((best, r) => (income(r) > income(best) ? r : best), "client" as Role);
      ewShare[top] = 1;
    } else {
      for (const r of roles) ewShare[r] = share(woning?.owner ?? "joint", r);
    }
  }

  // --- Reference year, per person ---------------------------------------------------
  const peopleCount = fiscal ? 2 : 1;
  const totalDividend = roles.reduce((sum, r) => sum + dividendOf(r), 0);

  const box3Joint = fiscal ? box3Tax({ savings: b3.savings, other: b3.investments + b3.otherRealEstate, debts: b3.debts }, 2) : null;
  const box3Own = (r: Role) =>
    box3Tax({ savings: sumCat("savings", r), other: sumCat("investments", r) + sumCat("otherRealEstate", r), debts: sumCat("debts", r) });
  const box3PerPerson = Object.fromEntries(roles.map((r) => [r, box3Own(r)])) as Record<Role, ReturnType<typeof box3Tax>>;
  const box3Total = box3Joint ?? {
    base: roles.reduce((x, r) => x + box3PerPerson[r].base, 0),
    deemedReturn: roles.reduce((x, r) => x + box3PerPerson[r].deemedReturn, 0),
    exemption: a.box3.heffingsvrijVermogen * roles.length,
    taxableBase: roles.reduce((x, r) => x + box3PerPerson[r].taxableBase, 0),
    tax: roles.reduce((x, r) => x + box3PerPerson[r].tax, 0),
  };

  const personResults: PersonResult[] = people.map(({ role, p }) => {
    const employment = employmentOf(role);
    const dga = dgaSalaryOf(role);
    const f = flowsAt(0, role);
    const gross1 = Math.max(0, employment + dga + f.box1 - f.lijfrenteContribution + forfait * ewShare[role]);
    const interest = yearlyMortgageInterest * ewShare[role];
    const box1Base = Math.max(0, gross1 - interest);
    const box1 = Math.max(
      0,
      progressiveTax(gross1, a.box1.brackets) -
        interest * a.box1.hypotheekrenteAftrekTarief -
        giftDeduction(f.deductibleGifts, gross1, a.box1.hypotheekrenteAftrekTarief),
    );
    const dividendReceived = fiscal ? totalDividend / 2 : dividendOf(role);
    const b2 = fiscal ? box2Tax(totalDividend, 2) / 2 : box2Tax(dividendOf(role), 1);
    const b3t = fiscal ? (box3Joint?.tax ?? 0) / 2 : box3PerPerson[role].tax;
    return {
      role,
      name: p.name,
      birthYear: p.birthYear,
      retirementYear: p.birthYear && p.retirementAge ? p.birthYear + p.retirementAge : null,
      aowYear: p.birthYear ? p.birthYear + a.aow.age : null,
      grossEmployment: round(employment),
      dgaSalary: round(dga),
      dividendReceived: round(dividendReceived),
      otherIncome: round(f.box1),
      taxFreeIncome: round(f.taxFree),
      box1Base: round(box1Base),
      box1Tax: round(box1),
      box2Tax: round(b2),
      box3Tax: round(b3t),
      net: round(employment + dga + f.box1 + f.taxFree + dividendReceived - box1 - b2 - b3t),
    };
  });

  const sumP = (k: "box1Tax" | "box1Base" | "box2Tax") => personResults.reduce((x, p) => x + p[k], 0);
  const box1TaxTotal = sumP("box1Tax");
  const box1BaseTotal = sumP("box1Base");
  const box2TaxTotal = sumP("box2Tax");
  const eff = (tax: number, base: number) => (base > 0 ? tax / base : 0);
  const box1Marginal = Math.max(
    0,
    ...roles.map((r) => {
      const gross = employmentOf(r) + dgaSalaryOf(r) + flowsAt(0, r).box1 + forfait * ewShare[r];
      return gross > 0 ? marginalRate(gross, a.box1.brackets) : 0;
    }),
  );

  const lines: TaxLine[] = [
    {
      box: 1,
      label: "Box 1 — werk en woning",
      base: round(box1BaseTotal),
      tax: round(box1TaxTotal),
      marginalRate: box1Marginal,
      effectiveRate: eff(box1TaxTotal, box1BaseTotal),
    },
    {
      box: 2,
      label: "Box 2 — aanmerkelijk belang",
      base: round(totalDividend),
      tax: round(box2TaxTotal),
      marginalRate: totalDividend > 0 ? marginalRate(totalDividend / peopleCount, a.box2.brackets) : 0,
      effectiveRate: eff(box2TaxTotal, totalDividend),
    },
    {
      box: 3,
      label: "Box 3 — sparen en beleggen",
      base: round(box3Total.taxableBase),
      tax: round(box3Total.tax),
      marginalRate: box3Total.taxableBase > 0 ? a.box3.tarief : 0,
      effectiveRate: eff(box3Total.tax, box3Total.base),
    },
  ];

  const grossEmployment = roles.reduce((x, r) => x + employmentOf(r), 0);
  const dgaSalary = roles.reduce((x, r) => x + dgaSalaryOf(r), 0);
  const otherIncome = personResults.reduce((x, p) => x + p.otherIncome, 0);
  const taxFreeIncome = personResults.reduce((x, p) => x + p.taxFreeIncome, 0);
  const taxTotal = box1TaxTotal + box2TaxTotal + box3Total.tax;
  const grossTotal = grossEmployment + dgaSalary + totalDividend + otherIncome + taxFreeIncome;
  const net = grossTotal - taxTotal;
  const expenses = s.inkomen ? input.prive.yearlyExpenses : 0;
  // Expense items and lijfrente contributions this year, on top of the fixed household expenses.
  const extraExpensesNow = itemExpensesAt(0) + roles.reduce((x, r) => x + flowsAt(0, r).lijfrenteContribution, 0);
  const balance = s.inkomen ? net - expenses - extraExpensesNow : 0;

  // --- Retirement --------------------------------------------------------------------
  const aowPerPerson = s.pensioen ? (hasPartner ? a.aow.samenwonend : a.aow.alleenstaand) : 0;
  const pensionOf = (p: PersonInput) => (s.pensioen ? p.pensionPerYear : 0);
  if (!h.client.birthYear) warnings.push("Geboortejaar ontbreekt: de projectie houdt geen rekening met pensionering.");

  // --- Gifts --------------------------------------------------------------------------
  type GiftEvent = { childName: string; childBirthYear: number | null; amount: number; oneOff: boolean };
  const giftsByYear = new Map<number, GiftEvent[]>();
  if (s.kinderen) {
    for (const g of h.gifts) {
      const years = g.kind === "eenmalig_verhoogd" ? 1 : Math.max(1, g.years);
      for (let y = g.startYear; y < g.startYear + years; y++) {
        const list = giftsByYear.get(y) ?? [];
        list.push({ childName: g.childName, childBirthYear: g.childBirthYear, amount: g.amount, oneOff: g.kind === "eenmalig_verhoogd" });
        giftsByYear.set(y, list);
      }
    }
  }
  const giftsTotalIn = (year: number) => (giftsByYear.get(year) ?? []).reduce((x, g) => x + g.amount, 0);
  const giftTaxFor = (year: number) => {
    const perChild = new Map<string, { name: string; age: number | null; amount: number; oneOff: boolean }>();
    for (const g of giftsByYear.get(year) ?? []) {
      const cur = perChild.get(g.childName) ?? { name: g.childName, age: g.childBirthYear ? year - g.childBirthYear : null, amount: 0, oneOff: false };
      cur.amount += g.amount;
      cur.oneOff ||= g.oneOff;
      perChild.set(g.childName, cur);
    }
    return [...perChild.values()].map((c) => {
      const oneOffAllowed = c.oneOff && c.age !== null && c.age >= a.schenking.eenmaligMinAge && c.age <= a.schenking.eenmaligMaxAge;
      const exemption = oneOffAllowed ? a.schenking.eenmaligVerhoogd : a.schenking.vrijstellingKind;
      const taxable = Math.max(0, c.amount - exemption);
      return {
        name: c.name,
        age: c.age,
        amount: round(c.amount),
        exemption,
        taxable: round(taxable),
        giftTax: round(progressiveTax(taxable, a.schenking.brackets)),
      };
    });
  };
  let gifts: GiftSummary | null = null;
  if (s.kinderen && (h.children.length > 0 || h.gifts.length > 0)) {
    const perChild = giftTaxFor(input.referenceYear);
    let totalPlanned = 0;
    for (const [y, list] of giftsByYear) if (y >= input.referenceYear) totalPlanned += list.reduce((x, g) => x + g.amount, 0);
    gifts = {
      year: input.referenceYear,
      totalThisYear: round(giftsTotalIn(input.referenceYear)),
      perChild,
      totalPlanned: round(totalPlanned),
      giftTaxThisYear: round(perChild.reduce((x, c) => x + c.giftTax, 0)),
    };
  }

  // --- Projection -------------------------------------------------------------------
  const funding = input.strategy?.retirementFunding ?? "box3_first";
  const allowances = fiscal ? 2 : roles.length;
  const bvRest = shareValue - ownLiquid;
  const points: ProjectionPoint[] = [];
  // Private wealth in two pots: savings (savings rate) and investments (scenario return, net of box 3 debts).
  const state = Object.fromEntries(
    SCENARIO_KEYS.map((k) => [
      k,
      { savings: b3.savings, invested: b3.investments + b3.otherRealEstate - b3.debts, bvLiquid: ownLiquid, house: eigenWoningValue },
    ]),
  ) as Record<ScenarioKey, { savings: number; invested: number; bvLiquid: number; house: number }>;
  const summary = { taxesPaid: 0, giftsGiven: 0, fundedFromBox3: 0, fundedFromBv: 0, depletedYear: null as number | null };

  for (let t = 0; t <= a.projectionYears; t++) {
    const year = input.referenceYear + t;
    const priceIndex = Math.pow(1 + a.inflation, t);
    const totals = {} as Record<ScenarioKey, number>;

    // Household income this year, in today's money (mortgage costs are part of the expenses).
    let netToday = 0;
    let box1Today = 0;
    let retainedToday = 0;
    let regularDividend = 0;
    for (const { role, p } of people) {
      const age = p.birthYear ? year - p.birthYear : null;
      const retYear = p.birthYear && p.retirementAge ? p.birthYear + p.retirementAge : null;
      const working = retYear === null || year < retYear;
      const labour = working ? employmentOf(role) + dgaSalaryOf(role) : 0;
      const pension = working ? 0 : pensionOf(p);
      const aow = age !== null && age >= a.aow.age ? aowPerPerson : 0;
      const f = flowsAt(t, role);
      const gross = Math.max(0, labour + pension + aow + f.box1 - f.lijfrenteContribution + forfait * ewShare[role]);
      const interest = yearlyMortgageInterest * ewShare[role];
      const pensioner = age !== null && age >= a.aow.age;
      const taxGross = pensioner ? gross * a.box1.pensionerRate : progressiveTax(gross, a.box1.brackets);
      const deductionRate = pensioner ? a.box1.pensionerRate : a.box1.hypotheekrenteAftrekTarief;
      const tax = Math.max(0, taxGross - interest * a.box1.hypotheekrenteAftrekTarief - giftDeduction(f.deductibleGifts, gross, deductionRate));
      box1Today += tax;
      netToday += labour + pension + aow + f.box1 - f.lijfrenteContribution + f.taxFree - tax;
      if (working) {
        regularDividend += dividendOf(role);
        retainedToday += retainedOf(role);
      }
    }
    const regularBox2Today = box2Tax(regularDividend, peopleCount);
    netToday += regularDividend - regularBox2Today;
    const spendingToday = (s.inkomen ? expenses + itemExpensesAt(t) : 0);

    for (const key of SCENARIO_KEYS) {
      const st = state[key];
      if (t > 0) {
        const r = a.scenarios[key].returnRate;
        const b3tax = box3Tax({ savings: Math.max(0, st.savings), other: Math.max(0, st.invested), debts: 0 }, allowances).tax;
        const giftsNow = giftsTotalIn(year);
        const dividendNominal = regularDividend * priceIndex;
        const buffer = (expenses / 12) * a.insights.bufferMonths * priceIndex;
        let extraBox2 = 0;

        st.savings = st.savings * (1 + a.savingsRate) - b3tax;
        st.invested = st.invested * (1 + r);
        st.bvLiquid = st.bvLiquid * (1 + r * a.bv.returnOnLiquidAssetsFactor) + retainedToday * priceIndex;

        /** Takes a net amount from the BV as extra dividend; returns what was received. */
        const takeFromBv = (netNeeded: number) => {
          if (netNeeded <= 0 || st.bvLiquid <= 0) return 0;
          const gross = Math.min(grossUpDividend(netNeeded, dividendNominal, peopleCount), st.bvLiquid);
          const tax = box2Tax(dividendNominal + gross, peopleCount) - box2Tax(dividendNominal, peopleCount);
          st.bvLiquid -= gross;
          extraBox2 += tax;
          if (key === "neutraal") summary.fundedFromBv += gross;
          return gross - tax;
        };

        // A kapitaalverzekering that pays out this year lands in savings.
        st.savings += kewPayout[t];
        const flow = (s.inkomen ? (netToday - spendingToday) * priceIndex : 0) - giftsNow;
        if (flow >= 0) {
          // Surplus tops up the cash buffer first, the rest is invested.
          const toSavings = Math.min(flow, Math.max(0, buffer - st.savings));
          st.savings += toSavings;
          st.invested += flow - toSavings;
        } else {
          let need = -flow;
          const bvShare = funding === "bv_first" ? 1 : funding === "mix" ? 0.5 : 0;
          need -= takeFromBv(need * bvShare);
          // Box 3: spend savings first, then sell investments.
          const fromSavings = Math.min(need, Math.max(0, st.savings));
          st.savings -= fromSavings;
          const fromInvested = Math.min(need - fromSavings, Math.max(0, st.invested));
          st.invested -= fromInvested;
          if (key === "neutraal") summary.fundedFromBox3 += fromSavings + fromInvested;
          need -= fromSavings + fromInvested;
          need -= takeFromBv(need);
          st.savings -= need; // nothing left: private wealth goes negative
        }

        st.house = st.house * (1 + a.houseValueGrowth);
        if (key === "neutraal") {
          summary.taxesPaid += (box1Today + regularBox2Today) * priceIndex + b3tax + extraBox2;
          summary.giftsGiven += giftsNow;
          if (summary.depletedYear === null && st.savings + st.invested < 0 && st.bvLiquid <= 0.5) summary.depletedYear = year;
        }
      }
      const houseNet = s.eigenWoning ? st.house - mortgageDebt : 0;
      totals[key] = round(st.savings + st.invested + st.bvLiquid + bvRest + houseNet + policyWealth[t] + tbsValue);
    }

    points.push({
      year,
      age: h.client.birthYear ? year - h.client.birthYear : null,
      pessimistisch: totals.pessimistisch,
      neutraal: totals.neutraal,
      optimistisch: totals.optimistisch,
      neutraalReeel: round(totals.neutraal / priceIndex),
      netIncome: round(s.inkomen ? netToday * priceIndex : 0),
      spending: round(spendingToday * priceIndex + giftsTotalIn(year)),
    });
  }

  if (summary.depletedYear !== null) {
    warnings.push("In het neutrale scenario raakt het vrij beschikbare vermogen binnen de projectieperiode uitgeput.");
  }

  const otherAssets = [
    ...policies.map((p) => ({ label: p.label, value: round(p.value) })),
    ...tbsLoans.map((l) => ({ label: l.label, value: round(l.amount) })),
  ];
  const otherAssetsTotal = otherAssets.reduce((x, o) => x + o.value, 0);
  const priveTotal = eigenWoningValue - mortgageDebt + box3Assets - b3.debts + otherAssetsTotal;

  return {
    engine: { name: "Plannr prototype-rekenkern", version: "0.3.0", isPrototype: true, assumptionsLabel: a.label },
    referenceYear: input.referenceYear,
    wealth: {
      prive: {
        eigenWoningValue: round(eigenWoningValue),
        mortgageDebt: round(mortgageDebt),
        eigenWoningNet: round(eigenWoningValue - mortgageDebt),
        box3Assets: round(box3Assets),
        box3Debts: round(b3.debts),
        box3Net: round(box3Assets - b3.debts),
        otherAssets,
        otherAssetsTotal: round(otherAssetsTotal),
        bvLoans: { total: round(bvDebtTotal), excess: round(bvExcess) },
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
          equity: s.balans ? c.equity : 0,
          liquidAssets: s.balans ? c.liquidAssets : 0,
          pensionObligation: s.pensioenEigenBeheer ? c.pensionObligation : 0,
          heldByHolding: c.heldByHolding,
          paidInCapital: c.paidInCapital,
        })),
      },
      total: round(priveTotal + shareValue),
    },
    income: {
      grossEmployment: round(grossEmployment),
      dgaSalary: round(dgaSalary),
      dividendReceived: round(totalDividend),
      otherIncome: round(otherIncome),
      taxFreeIncome: round(taxFreeIncome),
      grossTotal: round(grossTotal),
      taxTotal: round(taxTotal),
      net: round(net),
      expenses: round(expenses + extraExpensesNow),
      balance: round(balance),
    },
    taxes: {
      lines,
      total: round(taxTotal),
      effectiveRate: grossTotal > 0 ? taxTotal / grossTotal : 0,
      box3: {
        base: round(box3Total.base),
        deemedReturn: round(box3Total.deemedReturn),
        exemption: box3Total.exemption,
        taxableBase: round(box3Total.taxableBase),
      },
    },
    retirement: {
      retirementYear: personResults[0].retirementYear,
      aowPerYear: aowPerPerson * people.length,
      pensionPerYear: round(people.reduce((x, { p }) => x + pensionOf(p), 0)),
    },
    household: { fiscalPartners: fiscal, persons: personResults },
    gifts,
    projection: {
      scenarios: {
        pessimistisch: { ...a.scenarios.pessimistisch },
        neutraal: { ...a.scenarios.neutraal },
        optimistisch: { ...a.scenarios.optimistisch },
      },
      points,
      summary: {
        taxesPaid: round(summary.taxesPaid),
        giftsGiven: round(summary.giftsGiven),
        fundedFromBox3: round(summary.fundedFromBox3),
        fundedFromBv: round(summary.fundedFromBv),
        depletedYear: summary.depletedYear,
        endBvValue: round(state.neutraal.bvLiquid + bvRest),
      },
    },
    warnings,
  };
}
