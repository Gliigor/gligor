/**
 * Model configuration for Vee.
 *
 * Every model call in the app goes through `callModel()` in ./model.ts, and
 * every decision about WHICH model to use lives here. To swap a model, change
 * one line in this file (or set the matching environment variable on Vercel).
 */

/** The kinds of work Vee does. Each kind maps to a model tier. */
export type TaskKind =
  | "chat" // simple conversation, quick answers
  | "classify" // yes/no or label decisions (e.g. "does this need a reply?")
  | "triage" // email triage, summaries
  | "agent"; // multi-step planning and tool use

/** Two tiers: a fast, cheap model and a smart, more expensive one. */
export type ModelTier = "fast" | "smart";

export const TIER_FOR_TASK: Record<TaskKind, ModelTier> = {
  chat: "fast",
  classify: "fast",
  triage: "fast",
  agent: "smart",
};

/**
 * Resolved model IDs. Environment variables win so you can experiment on
 * Vercel without a redeploy; otherwise the defaults from the spec are used.
 */
export const MODEL_IDS: Record<ModelTier, string> = {
  fast: process.env.VEE_MODEL_FAST || "claude-haiku-4-5-20251001",
  smart: process.env.VEE_MODEL_SMART || "claude-opus-5-5",
};

/** Friendly labels shown in the UI so the user sees which "brain" answered. */
export const TIER_LABELS: Record<ModelTier, string> = {
  fast: "quick brain",
  smart: "deep brain",
};

/**
 * Output caps per tier. Chat answers should be short; agent work gets room.
 * These are hard ceilings, not targets.
 */
export const MAX_TOKENS: Record<ModelTier, number> = {
  fast: 2048,
  smart: 8192,
};
