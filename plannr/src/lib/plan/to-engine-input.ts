// Maps stored plan data (plans.config, plans.inputs, assets rows) onto the
// engine's PlanInput. This is the only place that knows both shapes.

import type {
  Box3Category,
  CashFlowItem,
  GiftInput,
  LoanInput,
  Owner,
  PlanInput,
  PolicyInput,
  ReturnRates,
  SoleTraderInput,
} from "@/lib/engine/types";
import { getCashKind } from "./definitions";
import type { AssetRow, PlanConfig, PlanInputs, ReturnPercents } from "./types";
import { toNumber } from "./types";

const BOX3_CATEGORY: Record<string, Box3Category> = {
  spaargeld: "savings",
  beleggingen: "investments",
  overig_vastgoed_nl: "otherRealEstate",
  schulden_box3: "debts",
  // Money lent to others is an "overige bezitting" in box 3, taxed like investments.
  vordering_derden: "investments",
};

/** A kapitaalverzekering that is not exempt is an ordinary box 3 asset. */
const isBox3Policy = (a: AssetRow) => a.type === "kapitaalverzekering" && a.metadata.fiscaal === "box3";

const POLICY_LABELS: Record<string, string> = {
  kapitaalverzekering: "Kapitaalverzekering",
  lijfrente: "Lijfrente",
  spaarrekening_eigen_woning: "Spaarrekening eigen woning",
  lening_dga: "Lening van de eigen BV",
  vordering_bv: "Lening aan de eigen BV",
};
const labelOf = (a: AssetRow) => a.label.trim() || POLICY_LABELS[a.type] || a.type;

function meta(asset: AssetRow, key: string): number {
  return toNumber(asset.metadata[key]) ?? 0;
}

/** Items that belong to the DGA personally unless stated otherwise. */
const CLIENT_BY_DEFAULT = new Set(["bv_aandelen", "eenmanszaak", "lening_dga", "vordering_bv", "lijfrente"]);

/** Owner stored in asset metadata; privé items default to joint, BV-related items to the client. */
export function ownerOf(asset: AssetRow): Owner {
  const o = asset.metadata.eigenaar;
  if (o === "client" || o === "partner" || o === "joint") return o;
  return CLIENT_BY_DEFAULT.has(asset.type) ? "client" : "joint";
}

const RETURN_MAP: Record<keyof ReturnPercents, keyof ReturnRates> = {
  sparen: "savings",
  beleggingen: "investments",
  vastgoed: "realEstate",
  bv: "bv",
  woning: "house",
};

/** Plan overrides firm defaults; both in percent. Missing values fall back to the engine defaults. */
export function effectiveReturns(firm: ReturnPercents | null | undefined, plan: ReturnPercents | null | undefined): Partial<ReturnRates> {
  const out: Partial<ReturnRates> = {};
  for (const [k, target] of Object.entries(RETURN_MAP) as [keyof ReturnPercents, keyof ReturnRates][]) {
    const v = plan?.[k] ?? firm?.[k];
    if (typeof v === "number") out[target] = v / 100;
  }
  return out;
}

export function toEngineInput(args: {
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  referenceYear: number;
  clientName?: string;
  /** The firm's default expected returns (percent). */
  firmReturns?: ReturnPercents | null;
}): PlanInput {
  const { config, inputs, assets, referenceYear } = args;
  const pattern = inputs.uitgangspunten.uitgavenpatroon;
  const c = config.sections;
  const p = inputs.prive;
  const pa = inputs.partner;

  const woning = assets.find((a) => a.type === "eigen_woning");
  const mortgages = assets
    .filter((a) => a.type === "hypotheek")
    .map((a) => ({
      amount: a.value ?? 0,
      interestRate: meta(a, "rente"),
      label: a.label || undefined,
      fixedRateUntil: typeof a.metadata.rentevast_tot === "number" ? a.metadata.rentevast_tot : null,
      startYear: typeof a.metadata.ingangsjaar === "number" ? a.metadata.ingangsjaar : null,
    }));

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
    returns: effectiveReturns(args.firmReturns, inputs.uitgangspunten.rendement),
    spendingPattern: {
      retiredPct: (pattern.pensioenPct ?? 100) / 100,
      laterAge: pattern.laterLeeftijd ?? 75,
      laterPct: (pattern.laterPct ?? pattern.pensioenPct ?? 100) / 100,
    },
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
      eenmanszaak: c.eenmanszaak,
    },
    prive: {
      yearlyExpenses: p.jaarlijkse_uitgaven ?? 0,
      eigenWoning:
        woning || mortgages.length > 0
          ? {
              wozValue: woning?.value ?? 0,
              marketValue: typeof woning?.metadata.vrije_verkoopwaarde === "number" ? woning.metadata.vrije_verkoopwaarde : null,
              mortgages,
              owner: woning ? ownerOf(woning) : "joint",
            }
          : null,
      box3: [
        ...assets
          .filter((a) => BOX3_CATEGORY[a.type] && (a.type !== "vordering_derden" || c.box3))
          .map((a) => ({ category: BOX3_CATEGORY[a.type], value: a.value ?? 0, owner: ownerOf(a) })),
        ...assets.filter(isBox3Policy).map((a) => ({ category: "investments" as const, value: a.value ?? 0, owner: ownerOf(a) })),
      ],
      cashItems: inputs.posten.flatMap((x): CashFlowItem[] => {
        const kind = getCashKind(x.soort);
        if (!kind || !c[kind.section] || !x.bedrag) return [];
        return [
          {
            label: x.omschrijving || kind.label,
            group: kind.group,
            tax: kind.tax,
            person: kind.perPerson ? (x.persoon ?? "client") : null,
            amount: x.bedrag,
            startYear: x.startjaar,
            startFrom: kind.defaultStart,
            endYear: kind.oneOff ? null : x.eindjaar,
            oneOff: kind.oneOff,
            growth: x.groei,
          },
        ];
      }),
      policies: assets
        .filter((a) => ["kapitaalverzekering", "lijfrente", "spaarrekening_eigen_woning"].includes(a.type) && !isBox3Policy(a))
        .map(
          (a): PolicyInput => ({
            kind: a.type as PolicyInput["kind"],
            label: labelOf(a),
            owner: ownerOf(a),
            value: a.value ?? 0,
            payoutYear: toNumber(a.metadata.uitkering_jaar),
            expectedPayout: toNumber(a.metadata.verwachte_uitkering),
            startYear: toNumber(a.metadata.start_uitkering),
            years: toNumber(a.metadata.duur_jaren),
            yearlyContribution: meta(a, "jaarlijkse_inleg"),
          }),
        ),
      loans: assets
        .filter((a) => a.type === "lening_dga" || a.type === "vordering_bv")
        .map(
          (a): LoanInput => ({
            kind: a.type as LoanInput["kind"],
            label: labelOf(a),
            owner: ownerOf(a),
            amount: a.value ?? 0,
            interestRate: meta(a, "rente"),
            forHome: a.metadata.eigen_woning === "ja",
          }),
        ),
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
          heldByHolding: a.metadata.gehouden_door === "holding",
          paidInCapital: meta(a, "aandelenkapitaal") + meta(a, "agio"),
        })),
      soleTraders: assets
        .filter((a) => a.type === "eenmanszaak")
        .map(
          (a): SoleTraderInput => ({
            name: typeof a.metadata.naam === "string" && a.metadata.naam ? a.metadata.naam : "Eenmanszaak",
            owner: ownerOf(a) === "partner" ? "partner" : "client",
            profit: meta(a, "winst"),
            businessAssets: a.value ?? 0,
            hoursCriterion: a.metadata.urencriterium !== "nee",
            starter: a.metadata.starter === "ja",
            endYear: toNumber(a.metadata.eindjaar),
          }),
        ),
    },
  };
}
