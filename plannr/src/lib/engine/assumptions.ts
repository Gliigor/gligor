// All assumptions used by the prototype calculation engine, in one place.
// These are simplified, indicative figures (based on Dutch 2025 rules) for a
// prototype. They are NOT suitable for real advice.

export const ASSUMPTIONS = {
  label: "Indicatieve uitgangspunten (gebaseerd op regels 2025), prototype",
  projectionYears: 30,
  inflation: 0.02,
  /** Yearly value growth of the eigen woning. */
  houseValueGrowth: 0.02,

  /** Return on savings accounts (all scenarios). Investments earn the scenario return. */
  savingsRate: 0.015,

  scenarios: {
    pessimistisch: { label: "Pessimistisch", returnRate: 0.015 },
    neutraal: { label: "Neutraal", returnRate: 0.04 },
    optimistisch: { label: "Optimistisch", returnRate: 0.06 },
  },

  box1: {
    /** Brackets for people below AOW age: upper bound (null = no upper bound) and rate. */
    brackets: [
      { upTo: 38_441, rate: 0.3582 },
      { upTo: 76_817, rate: 0.3748 },
      { upTo: null, rate: 0.495 },
    ],
    /** Simplified rate for income after AOW age (no AOW premium in bracket 1). */
    pensionerRate: 0.25,
    eigenwoningforfait: 0.0035,
    /** Maximum rate against which mortgage interest is deductible. */
    hypotheekrenteAftrekTarief: 0.3748,
  },

  box2: {
    brackets: [
      { upTo: 67_804, rate: 0.245 },
      { upTo: null, rate: 0.31 },
    ],
  },

  box3: {
    heffingsvrijVermogen: 57_684,
    schuldenDrempel: 3_800,
    forfaitBanktegoeden: 0.0144,
    forfaitOverigeBezittingen: 0.0588,
    forfaitSchulden: 0.0262,
    tarief: 0.36,
  },

  aow: {
    /** Gross yearly AOW benefit (indicative). */
    alleenstaand: 20_400,
    samenwonend: 14_000,
    age: 67,
  },

  schenking: {
    /** Yearly tax-free gift from a parent to a child (2025). */
    vrijstellingKind: 6_633,
    /** One-off higher exemption for a child aged 18–40 (2025), instead of the yearly one in that year. */
    eenmaligVerhoogd: 31_813,
    eenmaligMinAge: 18,
    eenmaligMaxAge: 40,
    /** Gift tax for children (paid by the child). */
    brackets: [
      { upTo: 152_368, rate: 0.1 },
      { upTo: null, rate: 0.2 },
    ],
  },

  /** Thresholds used by the "Aandachtspunten" rules (src/lib/insights). */
  insights: {
    /** Minimum salary the tax authority expects a DGA to receive (gebruikelijk loon, 2025). */
    gebruikelijkLoon: 56_000,
    /** Corporate income tax (Vpb, 2025). */
    vpb: { lowRate: 0.19, lowUpTo: 200_000, highRate: 0.258 },
    /** Recommended emergency buffer in months of household expenses. */
    bufferMonths: 6,
    /** BV cash above this amount without a stated purpose is flagged. */
    bvExcessCash: 250_000,
    /** Mortgage interest deduction lasts at most this many years. */
    hypotheekrenteaftrekJaren: 30,
  },

  bv: {
    /** The BV's liquid assets earn the scenario return after corporate tax (1 − 19% Vpb). */
    returnOnLiquidAssetsFactor: 0.81,
  },
} as const;

export type ScenarioKey = keyof typeof ASSUMPTIONS.scenarios;
export const SCENARIO_KEYS: ScenarioKey[] = ["pessimistisch", "neutraal", "optimistisch"];
