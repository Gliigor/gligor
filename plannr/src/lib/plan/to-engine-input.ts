// Maps stored plan data (plans.config, plans.inputs, assets rows) onto the
// engine's PlanInput. This is the only place that knows both shapes.

import type { Box3Category, GiftInput, Owner, PlanInput } from "@/lib/engine/types";
import type { AssetRow, PlanConfig, PlanInputs } from "./types";
import { toNumber } from "./types";

const BOX3_CATEGORY: Record<string, Box3Category> = {
  spaargeld: "savings",
  beleggingen: "investments",
  overig_vastgoed_nl: "otherRealEstate",
  schulden_box3: "debts",
};

function meta(asset: AssetRow, key: string): number {
  return toNumber(asset.metadata[key]) ?? 0;
}

/** Owner stored in asset metadata; privé items default to joint, a BV to the client. */
export function ownerOf(asset: AssetRow): Owner {
  const o = asset.metadata.eigenaar;
  if (o === "client" || o === "partner" || o === "joint") return o;
  return asset.type === "bv_aandelen" ? "client" : "joint";
}

export function toEngineInput(args: {
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  referenceYear: number;
  clientName?: string;
}): PlanInput {
  const { config, inputs, assets, referenceYear } = args;
  const c = config.sections;
  const p = inputs.prive;
  const pa = inputs.partner;

  const woning = assets.find((a) => a.type === "eigen_woning");
  const mortgages = assets
    .filter((a) => a.type === "hypotheek")
    .map((a) => ({ amount: a.value ?? 0, interestRate: meta(a, "rente") }));

  const childById = new Map(inputs.kinderen.map((k) => [k.id, k]));
  const gifts: GiftInput[] = inputs.schenkingen
    .filter((g) => g.bedrag && g.bedrag > 0 && g.startjaar)
    .map((g) => {
      const child = childById.get(g.kindId);
      return {
        childName: child?.naam || "Kind",
        childBirthYear: child?.geboortejaar ?? null,
        kind: g.soort,
        amount: g.bedrag ?? 0,
        startYear: g.startjaar ?? referenceYear,
        years: g.soort === "eenmalig_verhoogd" ? 1 : Math.max(1, g.jaren ?? 1),
      };
    });

  return {
    referenceYear,
    household: {
      client: {
        name: args.clientName ?? "Cliënt",
        birthYear: p.geboortejaar ?? null,
        retirementAge: p.pensioenleeftijd ?? null,
        grossEmploymentIncome: p.bruto_inkomen ?? 0,
        pensionPerYear: p.pensioen_per_jaar ?? 0,
      },
      partner: c.partner
        ? {
            name: pa.naam || "Partner",
            birthYear: pa.geboortejaar ?? null,
            retirementAge: pa.pensioenleeftijd ?? null,
            grossEmploymentIncome: pa.bruto_inkomen ?? 0,
            pensionPerYear: pa.pensioen_per_jaar ?? 0,
          }
        : null,
      relation: c.partner ? (pa.relatie ?? "gehuwd") : null,
      children: c.kinderen ? inputs.kinderen.map((k) => ({ name: k.naam || "Kind", birthYear: k.geboortejaar })) : [],
      gifts: c.kinderen ? gifts : [],
    },
    scope: {
      eigenWoning: c.eigen_woning,
      inkomen: c.inkomen,
      box3: c.box3,
      pensioen: c.pensioen,
      partner: c.partner,
      kinderen: c.kinderen,
      bv: c.bv,
      balans: c.balans,
      resultaat: c.resultaat,
      pensioenEigenBeheer: c.pensioen_eigen_beheer,
      dividend: c.dividend,
    },
    prive: {
      yearlyExpenses: p.jaarlijkse_uitgaven ?? 0,
      eigenWoning:
        woning || mortgages.length > 0
          ? { wozValue: woning?.value ?? 0, mortgages, owner: woning ? ownerOf(woning) : "joint" }
          : null,
      box3: assets
        .filter((a) => BOX3_CATEGORY[a.type])
        .map((a) => ({ category: BOX3_CATEGORY[a.type], value: a.value ?? 0, owner: ownerOf(a) })),
    },
    zakelijk: {
      companies: assets
        .filter((a) => a.type === "bv_aandelen")
        .map((a) => ({
          name: typeof a.metadata.bv_naam === "string" ? a.metadata.bv_naam : "",
          owner: ownerOf(a) === "partner" ? ("partner" as const) : ("client" as const),
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
