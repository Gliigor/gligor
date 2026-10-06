/**
 * Plan limits (monetization, section 6 of the spec).
 *
 * Nothing is enforced yet. This file exists so that when we add sign-in and
 * usage tracking, every limit check reads from ONE place.
 */

export type Plan = "free" | "paid";

export interface PlanLimits {
  /** How many apps (Gmail, Notion, ...) the user may connect. */
  maxConnectedApps: number;
  /** Agent actions per calendar month. `Infinity` means unlimited. */
  actionsPerMonth: number;
  /** Whether the proactive layer (email suggestions, daily card) is available. */
  proactive: boolean;
  /** Whether the smart (premium) model may be used. */
  smartModel: boolean;
  /** Whether cosmetic accessories for Vee are unlocked. */
  accessories: boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxConnectedApps: 2,
    actionsPerMonth: 50,
    proactive: false,
    smartModel: true, // keep on for the tryout so everyone can test it
    accessories: false,
  },
  paid: {
    maxConnectedApps: Infinity,
    actionsPerMonth: Infinity,
    proactive: true,
    smartModel: true,
    accessories: true,
  },
};

export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}
