// Maps stored plan data (plans.config, plans.inputs, assets rows) onto the
// engine's PlanInput. This is the only place that knows both shapes.

import type { PlanInput } from "@/lib/engine/types";
import type { AssetRow, PlanConfig, PlanInputs } from "./types";
import { toNumber } from "./types";

function sum(assets: AssetRow[], type: string): number {
  return assets.filter((a) => a.type === type).reduce((total, a) => total + (a.value ?? 0), 0);
}

function meta(asset: AssetRow, key: string): number {
  return toNumber(asset.metadata[key]) ?? 0;
}

export function toEngineInput(args: {
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  referenceYear: number;
}): PlanInput {
  const { config, inputs, assets, referenceYear } = args;
  const c = config.sections;
  const p = inputs.prive;

  const woning = assets.find((a) => a.type === "eigen_woning");
  const mortgages = assets
    .filter((a) => a.type === "hypotheek")
    .map((a) => ({ amount: a.value ?? 0, interestRate: meta(a, "rente") }));

  return {
    referenceYear,
    person: {
      birthYear: p.geboortejaar ?? null,
      retirementAge: p.pensioenleeftijd ?? null,
    },
    scope: {
      eigenWoning: c.eigen_woning,
      inkomen: c.inkomen,
      box3: c.box3,
      pensioen: c.pensioen,
      bv: c.bv,
      balans: c.balans,
      resultaat: c.resultaat,
      pensioenEigenBeheer: c.pensioen_eigen_beheer,
      dividend: c.dividend,
    },
    prive: {
      grossEmploymentIncome: p.bruto_inkomen ?? 0,
      yearlyExpenses: p.jaarlijkse_uitgaven ?? 0,
      pensionPerYear: p.pensioen_per_jaar ?? 0,
      aowSituation: p.aow_situatie ?? null,
      eigenWoning: woning || mortgages.length > 0 ? { wozValue: woning?.value ?? 0, mortgages } : null,
      box3: {
        savings: sum(assets, "spaargeld"),
        investments: sum(assets, "beleggingen"),
        otherRealEstate: sum(assets, "overig_vastgoed_nl"),
        debts: sum(assets, "schulden_box3"),
      },
    },
    zakelijk: {
      companies: assets
        .filter((a) => a.type === "bv_aandelen")
        .map((a) => ({
          name: typeof a.metadata.bv_naam === "string" ? a.metadata.bv_naam : "",
          sharePercentage: meta(a, "aandelen_percentage"),
          equity: meta(a, "eigen_vermogen"),
          liquidAssets: meta(a, "liquide_middelen"),
          resultAfterTax: meta(a, "resultaat_na_belasting"),
          pensionObligation: meta(a, "odv_waarde"),
          dgaSalary: meta(a, "salaris_dga"),
          dividend: meta(a, "dividenduitkering"),
        })),
    },
  };
}
