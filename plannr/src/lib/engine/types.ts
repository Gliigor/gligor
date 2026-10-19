// The contract between Plannr and its calculation engine ("rekenkern").
// The UI, results screen and PDF only ever see these two types. When the mock
// engine is replaced by a licensed calculation API, only the implementation
// behind calculatePlan() changes.

import type { ScenarioKey } from "./assumptions";

export type Owner = "client" | "partner" | "joint";
export type Relation = "gehuwd" | "samenwonend_fiscaal" | "samenwonend";
export type Box3Category = "savings" | "investments" | "otherRealEstate" | "debts";
export type RetirementFunding = "box3_first" | "bv_first" | "mix";

export interface PersonInput {
  name: string;
  birthYear: number | null;
  retirementAge: number | null;
  /** Salary from employment, excluding salary from an own BV. */
  grossEmploymentIncome: number;
  /** Pension from retirement age, excluding AOW (gross per year). */
  pensionPerYear: number;
}

export interface GiftInput {
  childName: string;
  childBirthYear: number | null;
  /** jaarlijks: regular yearly gift; eenmalig_verhoogd: the one-off higher exemption (age 18–40). */
  kind: "jaarlijks" | "eenmalig_verhoogd";
  /** Amount per year (for eenmalig_verhoogd: the one-off amount). */
  amount: number;
  startYear: number;
  years: number;
}

/** An income or expense item over time. Amounts are per year, in money of the reference year. */
export interface CashFlowItem {
  label: string;
  group: "inkomen" | "uitgave";
  /** box1: taxed in box 1; onbelast: tax-free income; aftrekbaar: deductible expense (gifts). */
  tax: "box1" | "onbelast" | "aftrekbaar" | "geen";
  person: "client" | "partner" | null;
  amount: number;
  /** null: from the reference year, or from the person's retirement year when startFrom is "pensioen". */
  startYear: number | null;
  startFrom: "nu" | "pensioen";
  /** Inclusive; null: no end. */
  endYear: number | null;
  oneOff: boolean;
  /** Yearly change in % (null: moves with inflation). */
  growth: number | null;
}

export interface PolicyInput {
  kind: "kapitaalverzekering" | "lijfrente" | "spaarrekening_eigen_woning";
  label: string;
  owner: Owner;
  value: number;
  /** Kapitaalverzekering: year of payout and expected payout (null: grown value). */
  payoutYear: number | null;
  expectedPayout: number | null;
  /** Lijfrente: first payout year, number of payout years and yearly contribution until then. */
  startYear: number | null;
  years: number | null;
  yearlyContribution: number;
}

export interface LoanInput {
  /** lening_dga: the person owes the own BV. vordering_bv: the person lent to the own BV (box 1, TBS). */
  kind: "lening_dga" | "vordering_bv";
  label: string;
  owner: Owner;
  amount: number;
  interestRate: number;
  /** lening_dga used for the eigen woning (box 1, outside the excessive-borrowing limit). */
  forHome: boolean;
}

export interface PlanInput {
  referenceYear: number;
  household: {
    client: PersonInput;
    partner: PersonInput | null;
    relation: Relation | null;
    children: { name: string; birthYear: number | null }[];
    gifts: GiftInput[];
  };
  /** Which parts of the plan are in scope. Out-of-scope parts are ignored. */
  scope: {
    eigenWoning: boolean;
    inkomen: boolean;
    box3: boolean;
    pensioen: boolean;
    partner: boolean;
    kinderen: boolean;
    bv: boolean;
    balans: boolean;
    resultaat: boolean;
    pensioenEigenBeheer: boolean;
    dividend: boolean;
  };
  prive: {
    /** Household expenses per year (shared by client and partner). */
    yearlyExpenses: number;
    eigenWoning: { wozValue: number; mortgages: { amount: number; interestRate: number }[]; owner: Owner } | null;
    box3: { category: Box3Category; value: number; owner: Owner }[];
    /** Income and expenses over time, on top of the yearly figures above. */
    cashItems: CashFlowItem[];
    /** Exempt policies and balances outside box 3 (KEW, lijfrente, spaarrekening eigen woning). */
    policies: PolicyInput[];
    loans: LoanInput[];
  };
  zakelijk: {
    companies: {
      name: string;
      owner: "client" | "partner";
      sharePercentage: number;
      equity: number;
      liquidAssets: number;
      resultAfterTax: number;
      pensionObligation: number;
      dgaSalary: number;
      dividend: number;
      /** Held by another BV (holding): not in box 2 itself; its profit flows to the holding. */
      heldByHolding: boolean;
      /** Share capital plus agio: can be repaid without box 2 tax. */
      paidInCapital: number;
    }[];
  };
  /** Choices that change how the future is modelled (used by the comparisons). */
  strategy?: {
    /** After retirement: which source covers a shortfall first. Default "box3_first". */
    retirementFunding?: RetirementFunding;
  };
}

export interface TaxLine {
  box: 1 | 2 | 3;
  label: string;
  base: number;
  tax: number;
  /** Rate on the next euro in this box (box 3: rate on the deemed return). */
  marginalRate: number;
  /** tax / base (0 when there is no base). */
  effectiveRate: number;
}

export interface ProjectionPoint {
  year: number;
  age: number | null;
  pessimistisch: number;
  neutraal: number;
  optimistisch: number;
  /** Neutral scenario in today's money (corrected for inflation). */
  neutraalReeel: number;
  /** Household net income and spending this year (nominal, incl. gifts to children). */
  netIncome: number;
  spending: number;
}

export interface PersonResult {
  role: "client" | "partner";
  name: string;
  birthYear: number | null;
  retirementYear: number | null;
  aowYear: number | null;
  grossEmployment: number;
  dgaSalary: number;
  dividendReceived: number;
  /** Other box 1 income: items, lijfrente and TBS interest. */
  otherIncome: number;
  taxFreeIncome: number;
  box1Base: number;
  box1Tax: number;
  box2Tax: number;
  box3Tax: number;
  net: number;
}

export interface GiftSummary {
  year: number;
  /** Gifts in the reference year. */
  totalThisYear: number;
  perChild: { name: string; age: number | null; amount: number; exemption: number; taxable: number; giftTax: number }[];
  /** All planned gifts over the projection. */
  totalPlanned: number;
  /** Schenkbelasting is paid by the child, not by the parents. */
  giftTaxThisYear: number;
}

export interface PlanResult {
  engine: { name: string; version: string; isPrototype: boolean; assumptionsLabel: string };
  referenceYear: number;

  wealth: {
    prive: {
      eigenWoningValue: number;
      mortgageDebt: number;
      eigenWoningNet: number;
      box3Assets: number;
      box3Debts: number;
      box3Net: number;
      /** Policies and loans outside box 3 (KEW, lijfrente, spaarrekening eigen woning, loans to the own BV). */
      otherAssets: { label: string; value: number }[];
      otherAssetsTotal: number;
      /** Debts to the own BV: total, and the part above the excessive-borrowing limit (taxed in box 2). */
      bvLoans: { total: number; excess: number };
      total: number;
    };
    zakelijk: {
      shareValue: number;
      equity: number;
      liquidAssets: number;
      pensionObligation: number;
      total: number;
      /** Echo of the companies that were calculated, for reporting. */
      companies: {
        name: string;
        sharePercentage: number;
        resultAfterTax: number;
        dividend: number;
        dgaSalary: number;
        equity: number;
        liquidAssets: number;
        pensionObligation: number;
        heldByHolding: boolean;
        paidInCapital: number;
      }[];
    };
    total: number;
  };

  income: {
    grossEmployment: number;
    dgaSalary: number;
    dividendReceived: number;
    otherIncome: number;
    taxFreeIncome: number;
    grossTotal: number;
    taxTotal: number;
    net: number;
    expenses: number;
    balance: number;
  };

  taxes: {
    lines: TaxLine[];
    total: number;
    /** Total tax / gross income (0 when there is no income). */
    effectiveRate: number;
    box3: { base: number; deemedReturn: number; exemption: number; taxableBase: number };
  };

  retirement: {
    /** Retirement year of the client. */
    retirementYear: number | null;
    /** Household totals (gross per year, once everyone receives them). */
    aowPerYear: number;
    pensionPerYear: number;
  };

  household: {
    /** Married, registered or cohabiting as fiscal partners: box 2 and box 3 can be divided freely. */
    fiscalPartners: boolean;
    persons: PersonResult[];
  };

  gifts: GiftSummary | null;

  projection: {
    scenarios: Record<ScenarioKey, { label: string; returnRate: number }>;
    points: ProjectionPoint[];
    /** Totals over the whole projection, neutral scenario (nominal). */
    summary: {
      taxesPaid: number;
      giftsGiven: number;
      /** Shortfalls after retirement covered from box 3 resp. from the BV (gross dividend). */
      fundedFromBox3: number;
      fundedFromBv: number;
      depletedYear: number | null;
      /** Value of the BV shares at the end (neutral): still subject to box 2 when paid out. */
      endBvValue: number;
    };
  };

  warnings: string[];
}
