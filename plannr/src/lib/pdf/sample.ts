// Sample data used for house-style previews (no real client data).

import { calculatePlan } from "@/lib/engine";
import type { PlanInput } from "@/lib/engine/types";
import { REPORT_SECTION_KEYS } from "@/lib/plan/definitions";
import type { ReportData } from "./report";

export const SAMPLE_INPUT: PlanInput = {
  referenceYear: new Date().getFullYear(),
  person: { birthYear: 1972, retirementAge: 65 },
  scope: {
    eigenWoning: true,
    inkomen: true,
    box3: true,
    pensioen: true,
    bv: true,
    balans: true,
    resultaat: true,
    pensioenEigenBeheer: true,
    dividend: true,
  },
  prive: {
    grossEmploymentIncome: 0,
    yearlyExpenses: 78_000,
    pensionPerYear: 18_000,
    aowSituation: "samenwonend",
    eigenWoning: { wozValue: 925_000, mortgages: [{ amount: 380_000, interestRate: 3.6 }] },
    box3: { savings: 85_000, investments: 240_000, otherRealEstate: 0, debts: 0 },
  },
  zakelijk: {
    companies: [
      {
        name: "Voorbeeld Holding B.V.",
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
  return {
    firmName,
    clientName: "Familie Voorbeeld",
    companyName: "Voorbeeld Holding B.V.",
    planTitle: "Voorbeeldrapport",
    plannerName: null,
    generatedAt: new Date(),
    result: await calculatePlan(SAMPLE_INPUT),
    sections: [...REPORT_SECTION_KEYS],
  };
}
