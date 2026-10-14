// The contract between Plannr and its calculation engine ("rekenkern").
// The UI, results screen and PDF only ever see these two types. When the mock
// engine is replaced by a licensed calculation API, only the implementation
// behind calculatePlan() changes.

import type { ScenarioKey } from "./assumptions";

export interface PlanInput {
  referenceYear: number;
  person: {
    birthYear: number | null;
    retirementAge: number | null;
  };
  /** Which parts of the plan are in scope. Out-of-scope parts are ignored. */
  scope: {
    eigenWoning: boolean;
    inkomen: boolean;
    box3: boolean;
    pensioen: boolean;
    bv: boolean;
    balans: boolean;
    resultaat: boolean;
    pensioenEigenBeheer: boolean;
    dividend: boolean;
  };
  prive: {
    grossEmploymentIncome: number;
    yearlyExpenses: number;
    pensionPerYear: number;
    aowSituation: "alleenstaand" | "samenwonend" | null;
    eigenWoning: { wozValue: number; mortgages: { amount: number; interestRate: number }[] } | null;
    box3: { savings: number; investments: number; otherRealEstate: number; debts: number };
  };
  zakelijk: {
    companies: {
      name: string;
      sharePercentage: number;
      equity: number;
      liquidAssets: number;
      resultAfterTax: number;
      pensionObligation: number;
      dgaSalary: number;
      dividend: number;
    }[];
  };
}

export interface TaxLine {
  box: 1 | 2 | 3;
  label: string;
  base: number;
  tax: number;
}

export interface ProjectionPoint {
  year: number;
  age: number | null;
  pessimistisch: number;
  neutraal: number;
  optimistisch: number;
  /** Neutral scenario in today's money (corrected for inflation). */
  neutraalReeel: number;
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
      total: number;
    };
    zakelijk: {
      shareValue: number;
      equity: number;
      liquidAssets: number;
      pensionObligation: number;
      total: number;
      /** Echo of the companies that were calculated, for reporting. */
      companies: { name: string; sharePercentage: number; resultAfterTax: number; dividend: number; dgaSalary: number }[];
    };
    total: number;
  };

  income: {
    grossEmployment: number;
    dgaSalary: number;
    dividendReceived: number;
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
    retirementYear: number | null;
    aowPerYear: number;
    pensionPerYear: number;
  };

  projection: {
    scenarios: Record<ScenarioKey, { label: string; returnRate: number }>;
    points: ProjectionPoint[];
  };

  warnings: string[];
}
