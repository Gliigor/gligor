/**
 * Decides whether a message should go to the fast model or the smart one.
 *
 * Strategy:
 * 1. If the user forced a tier ("fast" / "smart"), respect it.
 * 2. Otherwise ask the fast model a one-word question: does this need
 *    planning or multiple steps? That call costs a fraction of a cent and
 *    keeps simple chat cheap.
 * 3. If the classifier fails for any reason, fall back to a keyword check.
 */
import { callModel, type ChatMessage } from "./model.js";
import type { ModelTier } from "./models.js";

export type RoutingMode = "auto" | ModelTier;

const CLASSIFIER_SYSTEM = `You route messages for a personal assistant app.
Answer with exactly one word: "simple" or "complex".
"complex" = needs multi-step planning, reasoning over several items, careful writing, code, or tool use (email triage, calendar changes, research).
"simple" = greetings, small talk, quick facts, short rewrites, one-line questions.`;

const COMPLEX_HINTS = /\b(plan|schedule|book|triage|summari[sz]e|draft|write|compare|analy[sz]e|research|calendar|email|inbox|notion|note)\b/i;

export async function chooseTier(messages: ChatMessage[], mode: RoutingMode): Promise<ModelTier> {
  if (mode === "fast" || mode === "smart") return mode;

  const last = messages[messages.length - 1];
  if (!last || last.role !== "user") return "fast";

  // Very short messages are almost never complex. Skip the classifier call.
  if (last.content.trim().length < 12) return "fast";

  try {
    const { text } = await callModel({
      task: "classify",
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: last.content.slice(0, 2000) }],
      maxTokens: 5,
    });
    return /complex/i.test(text) ? "smart" : "fast";
  } catch {
    return COMPLEX_HINTS.test(last.content) ? "smart" : "fast";
  }
}
