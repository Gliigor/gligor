// Derived figures for a BV whose full balance sheet and P&L are entered
// ("uitgebreid"). Used by the zakelijk step (to show them) and by sanitize (to
// store them), so both always agree. Indicative: no fiscal adjustments beyond
// loss carry-forward.

import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { progressiveTax } from "@/lib/engine/tax-math";

const ASSET_KEYS = ["vaste_activa", "deelnemingen", "vordering_dga", "overige_vorderingen", "liquide_middelen"] as const;
const LIABILITY_KEYS = ["odv_waarde", "schuld_dga", "bankleningen", "overige_schulden"] as const;
const BALANCE_KEYS = ["vaste_activa", "deelnemingen", "vordering_dga", "overige_vorderingen", "schuld_dga", "bankleningen", "overige_schulden"] as const;
const PNL_KEYS = ["opbrengsten", "management_fee", "bedrijfskosten", "afschrijvingen"] as const;

type Meta = Record<string, unknown>;

const n = (meta: Meta, key: string) => (typeof meta[key] === "number" ? (meta[key] as number) : 0);
const has = (meta: Meta, keys: readonly string[]) => keys.some((k) => typeof meta[k] === "number");

export function isExtended(meta: Meta): boolean {
  return meta.uitgebreid === "ja";
}

/** Vpb on a profit, after deducting losses carried forward. */
export function corporateTax(profit: number, lossCarryForward = 0): number {
  const v = ASSUMPTIONS.insights.vpb;
  const taxable = Math.max(0, profit - Math.max(0, lossCarryForward));
  return progressiveTax(taxable, [
    { upTo: v.lowUpTo, rate: v.lowRate },
    { upTo: null, rate: v.highRate },
  ]);
}

export interface BvDerived {
  totalAssets: number;
  totalLiabilities: number;
  /** null when the balance-sheet details are not filled in. */
  equity: number | null;
  profitBeforeTax: number | null;
  vpb: number | null;
  /** null when the P&L details are not filled in. */
  resultAfterTax: number | null;
}

export function deriveBv(meta: Meta): BvDerived {
  const totalAssets = ASSET_KEYS.reduce((sum, k) => sum + n(meta, k), 0);
  const totalLiabilities = LIABILITY_KEYS.reduce((sum, k) => sum + n(meta, k), 0);
  const extended = isExtended(meta);
  const equity = extended && has(meta, BALANCE_KEYS) ? Math.round((totalAssets - totalLiabilities) * 100) / 100 : null;

  let profitBeforeTax: number | null = null;
  let vpb: number | null = null;
  let resultAfterTax: number | null = null;
  if (extended && has(meta, PNL_KEYS)) {
    // The DGA salary is a cost of the BV that pays it.
    profitBeforeTax =
      n(meta, "opbrengsten") + n(meta, "management_fee") - n(meta, "bedrijfskosten") - n(meta, "afschrijvingen") - n(meta, "salaris_dga");
    vpb = Math.round(corporateTax(profitBeforeTax, n(meta, "verlies_te_verrekenen")) * 100) / 100;
    resultAfterTax = Math.round((profitBeforeTax - vpb) * 100) / 100;
  }
  return { totalAssets, totalLiabilities, equity, profitBeforeTax, vpb, resultAfterTax };
}

/** Writes the derived equity and result into the metadata when the details are filled in. */
export function applyBvDerivations<M extends Meta>(meta: M): M {
  if (!isExtended(meta)) return meta;
  const d = deriveBv(meta);
  const out: Meta = { ...meta };
  if (d.equity !== null) out.eigen_vermogen = d.equity;
  if (d.resultAfterTax !== null) out.resultaat_na_belasting = d.resultAfterTax;
  return out as M;
}
