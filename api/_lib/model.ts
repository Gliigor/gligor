/**
 * The ONE place the app talks to an AI model.
 *
 * Everything else (chat endpoint, future tools, email triage, ...) calls
 * `callModel()` or `streamModel()` and never imports the Anthropic SDK
 * directly. That way we can swap models or even providers later by editing
 * this file only.
 */
import Anthropic from "@anthropic-ai/sdk";
import { MAX_TOKENS, MODEL_IDS, TIER_FOR_TASK, type ModelTier, type TaskKind } from "./models.js";

/** A plain chat message as the rest of the app sees it. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CallModelOptions {
  /** What kind of work this is. Decides which model tier is used. */
  task: TaskKind;
  /** Full conversation so far (the API is stateless). */
  messages: ChatMessage[];
  /** Optional system prompt. Keep it stable so prompt caching can kick in. */
  system?: string;
  /** Per-person instructions appended after `system`, outside the cached prefix. */
  systemExtra?: string;
  /** Tool definitions in Claude's tool-use format. Unused until Phase 4. */
  tools?: Anthropic.Tool[];
  /** Override the tier chosen for the task (e.g. the user forced "smart"). */
  tier?: ModelTier;
  /** Hard cap on output tokens. Defaults per tier. */
  maxTokens?: number;
  /** Abort signal so a closed browser tab stops the model call. */
  signal?: AbortSignal;
}

/** Events emitted while a reply streams in. */
export type ModelEvent =
  | { type: "meta"; tier: ModelTier; model: string }
  | { type: "text"; text: string }
  | { type: "done"; stopReason: string | null; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string };

/** True on the live (production) Vercel deployment. */
function isProduction(): boolean {
  return process.env.VERCEL_ENV === "production";
}

/**
 * True when the app answers with canned text instead of calling Claude:
 * forced with VEE_MOCK=1, or no API key outside production (your own
 * computer and preview links), so screens can be tested for free.
 */
export function isMockMode(): boolean {
  return process.env.VEE_MOCK === "1" || (!process.env.ANTHROPIC_API_KEY && !isProduction());
}

/**
 * True when the live site has no API key. Real visitors then get a friendly
 * "taking a break" message instead of canned mock replies.
 */
export function isUnavailable(): boolean {
  return !isMockMode() && !process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    // Reads ANTHROPIC_API_KEY from the environment. Never pass a key from the browser.
    client = new Anthropic({ maxRetries: 2, timeout: 55_000 });
  }
  return client;
}

function resolveTier(opts: CallModelOptions): ModelTier {
  return opts.tier ?? TIER_FOR_TASK[opts.task];
}

/**
 * Build the request for the Anthropic Messages API.
 *
 * Model-specific rules live here so callers don't need to know them:
 * - Opus 5.5 always thinks; we leave `thinking` unset and steer depth with
 *   `output_config.effort`. "medium" is a good default for agent work.
 * - Haiku 4.5 does not think unless asked; for chat we don't ask.
 */
function buildRequest(opts: CallModelOptions, tier: ModelTier): Anthropic.MessageCreateParamsStreaming {
  const model = MODEL_IDS[tier];
  const params: Anthropic.MessageCreateParamsStreaming = {
    model,
    max_tokens: opts.maxTokens ?? MAX_TOKENS[tier],
    messages: opts.messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  };
  if (opts.system) {
    // Mark the system prompt cacheable: identical prefixes get ~90% cheaper.
    params.system = [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }];
    if (opts.systemExtra) params.system.push({ type: "text", text: opts.systemExtra });
  }
  if (opts.tools && opts.tools.length > 0) {
    params.tools = opts.tools;
  }
  if (tier === "smart") {
    params.output_config = { effort: "medium" };
  }
  return params;
}

/**
 * Stream a reply. Yields `meta` first, then `text` chunks, then `done`.
 * If anything goes wrong an `error` event is yielded instead of throwing,
 * so the HTTP layer can forward it to the browser cleanly.
 */
export async function* streamModel(opts: CallModelOptions): AsyncGenerator<ModelEvent> {
  const tier = resolveTier(opts);

  if (isMockMode()) {
    yield* mockStream(opts, tier);
    return;
  }

  const model = MODEL_IDS[tier];
  yield { type: "meta", tier, model };

  try {
    const stream = getClient().messages.stream(buildRequest(opts, tier), { signal: opts.signal });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "text", text: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield { type: "text", text: "\n\nSorry, I can't help with that one." };
    }
    yield {
      type: "done",
      stopReason: final.stop_reason,
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    };
  } catch (err) {
    yield { type: "error", message: describeError(err) };
  }
}

/**
 * Non-streaming convenience: returns the whole text. Used for small internal
 * calls like classification where streaming adds nothing.
 */
export async function callModel(opts: CallModelOptions): Promise<{ text: string; tier: ModelTier; model: string }> {
  let text = "";
  let tier = resolveTier(opts);
  let model = MODEL_IDS[tier];
  for await (const ev of streamModel(opts)) {
    if (ev.type === "meta") {
      tier = ev.tier;
      model = ev.model;
    } else if (ev.type === "text") {
      text += ev.text;
    } else if (ev.type === "error") {
      throw new Error(ev.message);
    }
  }
  return { text, tier, model };
}

/** Turn SDK errors into a short message that is safe to show the user. */
function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The server's API key was rejected.";
  if (err instanceof Anthropic.RateLimitError) return "Vee is a bit overloaded right now. Try again in a moment.";
  if (err instanceof Anthropic.BadRequestError) return `The model rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Couldn't reach the model service.";
  if (err instanceof Anthropic.APIError) return `Model service error (${err.status}).`;
  if (err instanceof Error && err.name === "AbortError") return "Cancelled.";
  return "Something went wrong talking to the model.";
}

/**
 * Mock replies so the whole UI can be tested without an API key (and without
 * spending money). Streams word by word to mimic the real thing.
 */
async function* mockStream(opts: CallModelOptions, tier: ModelTier): AsyncGenerator<ModelEvent> {
  yield { type: "meta", tier, model: `mock-${tier}` };
  const last = opts.messages[opts.messages.length - 1]?.content ?? "";
  const reply =
    opts.task === "classify"
      ? "no"
      : `(Mock mode, no API key set.) You said: "${last.slice(0, 120)}". ` +
        `This would have been answered by the ${tier} model. Add ANTHROPIC_API_KEY on Vercel to talk to the real Vee.`;
  for (const word of reply.split(" ")) {
    await new Promise((r) => setTimeout(r, 25));
    yield { type: "text", text: word + " " };
  }
  yield { type: "done", stopReason: "end_turn", inputTokens: 0, outputTokens: 0 };
}
