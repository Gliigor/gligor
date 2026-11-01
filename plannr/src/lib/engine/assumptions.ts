// All assumptions used by the prototype calculation engine, in one place.
// These are simplified, indicative figures (based on Dutch 2025 rules) for a
// prototype. They are NOT suitable for real advice.

export const ASSUMPTIONS = {
  label: "Indicatieve uitgangspunten (gebaseerd op regels 2025), prototype",
  projectionYears: 30,
  /** Average Dutch consumer price inflation (CBS CPI) over roughly the last 25 years. */
  inflation: 0.023,
  /** Yearly value growth of the eigen woning. */
  houseValueGrowth: 0.02,

  /** Return on savings accounts (all scenarios). Investments earn the scenario return. */
  savingsRate: 0.015,

  scenarios: {
    pessimistisch: { label: "Pessimistisch", returnRate: 0.015 },
    neutraal: { label: "Neutraal", returnRate: 0.04 },
    optimistisch: { label: "Optimistisch", returnRate: 0.06 },
  },

  /**
   * Realistisch verwacht rendement (RVR) per kind of wealth: the neutral scenario.
   * A firm can set its own defaults and a plan can override them.
   */
  rvr: { savings: 0.015, investments: 0.04, realEstate: 0.04, bv: 0.04, house: 0.02 },
  /** Pessimistic and optimistic scenarios: RVR plus this spread (investments and BV; half for real estate). */
  scenarioSpread: { pessimistisch: -0.025, neutraal: 0, optimistisch: 0.02 },

  /** Default spending pattern: share of today's household expenses per life phase. */
  spendingPattern: { retiredPct: 1, laterAge: 75, laterPct: 1 },

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
    /**
     * Estimated AOW age by birth year (years, months). Set by law five years ahead
     * and linked to life expectancy, so later cohorts are estimates.
     */
    byBirthYear: [
      { bornUpTo: 1960, years: 67, months: 0 },
      { bornUpTo: 1964, years: 67, months: 3 },
      { bornUpTo: 1969, years: 67, months: 6 },
      { bornUpTo: 1975, years: 67, months: 9 },
      { bornUpTo: null, years: 68, months: 0 },
    ],
  },

  /** IB-ondernemer (eenmanszaak), 2025. */
  ondernemer: {
    zelfstandigenaftrek: 2_470,
    startersaftrek: 2_123,
    /** Startersaftrek applies in the first years of the business. */
    starterJaren: 3,
    mkbWinstvrijstelling: 0.127,
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
    /** Wet excessief lenen: debts to the own BV above this amount (excluding eigen-woningschulden) are taxed in box 2. */
    excessiefLenenGrens: 500_000,
  },

  /** Insurance policies and lijfrente balances grow at this fixed rate (all scenarios). */
  policyReturn: 0.03,

  giften: {
    /** Deductible part of gifts: above 1% of the income, at most 10% of the income. */
    drempel: 0.01,
    maximum: 0.1,
  },
} as const;

export type ScenarioKey = keyof typeof ASSUMPTIONS.scenarios;
export const SCENARIO_KEYS: ScenarioKey[] = ["pessimistisch", "neutraal", "optimistisch"];
