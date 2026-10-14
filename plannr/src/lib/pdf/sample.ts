// Sample data used for house-style previews (no real client data).

import { calculatePlan } from "@/lib/engine";
import { deriveInsights } from "@/lib/insights";
import type { PlanInput } from "@/lib/engine/types";
import { REPORT_SECTION_KEYS } from "@/lib/plan/definitions";
import type { ReportData } from "./report";

export const SAMPLE_INPUT: PlanInput = {
  referenceYear: new Date().getFullYear(),
  household: {
    client: { name: "Jan", birthYear: 1972, retirementAge: 63, grossEmploymentIncome: 0, pensionPerYear: 12_000 },
    partner: { name: "Eva", birthYear: 1974, retirementAge: 65, grossEmploymentIncome: 48_000, pensionPerYear: 14_000 },
    relation: "gehuwd",
    children: [
      { name: "Sophie", birthYear: 2002 },
      { name: "Daan", birthYear: 2005 },
    ],
    gifts: [
      { childName: "Sophie", childBirthYear: 2002, kind: "jaarlijks", amount: 6_633, startYear: new Date().getFullYear(), years: 10 },
      { childName: "Daan", childBirthYear: 2005, kind: "jaarlijks", amount: 6_633, startYear: new Date().getFullYear(), years: 10 },
    ],
  },
  scope: {
    eigenWoning: true,
    inkomen: true,
    box3: true,
    pensioen: true,
    partner: true,
    kinderen: true,
    bv: true,
    balans: true,
    resultaat: true,
    pensioenEigenBeheer: true,
    dividend: true,
  },
  prive: {
    yearlyExpenses: 96_000,
    eigenWoning: { wozValue: 925_000, mortgages: [{ amount: 380_000, interestRate: 3.6 }], owner: "joint" },
    box3: [
      { category: "savings", value: 85_000, owner: "joint" },
      { category: "investments", value: 240_000, owner: "joint" },
    ],
  },
  zakelijk: {
    companies: [
      {
        name: "Voorbeeld Holding B.V.",
        owner: "client",
        sharePercentage: 100,
        equity: 1_350_000,
        liquidAssets: 520_000,
        resultAfterTax: 210_000,
        pensionObligation: 265_000,
        dgaSalary: 66_000,
        dividend: 60_000,
      },
    ],
  },
};

export async function sampleReportData(firmName: string): Promise<ReportData> {
  const result = await calculatePlan(SAMPLE_INPUT);
  return {
    firmName,
    clientName: "Familie Voorbeeld",
    companyName: "Voorbeeld Holding B.V.",
    planTitle: "Voorbeeldrapport",
    plannerName: null,
    generatedAt: new Date(),
    result,
    sections: [...REPORT_SECTION_KEYS],
    insights: deriveInsights(SAMPLE_INPUT, result),
  };
}
