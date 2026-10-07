/**
 * POST /api/chat
 *
 * Body: { messages: [{ role, content }], mode?: "auto" | "fast" | "smart", profile?: VeeProfile }
 * Reply: a Server-Sent-Events stream with events:
 *   meta  { tier, model }
 *   text  { text }
 *   done  { stopReason, inputTokens, outputTokens }
 *   error { message }
 *
 * The Anthropic API key never leaves this server.
 */
import { streamModel, type ChatMessage } from "./_lib/model.js";
import { chooseTier, type RoutingMode } from "./_lib/router.js";
import { VEE_SYSTEM_PROMPT } from "./_lib/prompts.js";
import { parseProfile, profilePrompt, type VeeProfile } from "./_lib/profile.js";
import { checkAccess, json, sseEvent, SSE_HEADERS } from "./_lib/http.js";

// Vercel reads this to allow longer streaming replies (seconds).
export const maxDuration = 60;

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

interface ChatBody {
  messages?: unknown;
  mode?: unknown;
  profile?: unknown;
}

function parseBody(body: ChatBody): { messages: ChatMessage[]; mode: RoutingMode; profile: VeeProfile | null } | string {
  if (!Array.isArray(body.messages) || body.messages.length === 0) return "messages must be a non-empty array";
  if (body.messages.length > MAX_MESSAGES) return `at most ${MAX_MESSAGES} messages per request`;

  const messages: ChatMessage[] = [];
  for (const m of body.messages as unknown[]) {
    if (!m || typeof m !== "object") return "each message must be an object";
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return "message role must be user or assistant";
    if (typeof content !== "string" || !content.trim()) return "message content must be a non-empty string";
    if (content.length > MAX_MESSAGE_CHARS) return `messages must be under ${MAX_MESSAGE_CHARS} characters`;
    messages.push({ role, content });
  }
  if (messages[0].role !== "user") return "the first message must be from the user";
  if (messages[messages.length - 1].role !== "user") return "the last message must be from the user";

  const mode: RoutingMode = body.mode === "fast" || body.mode === "smart" ? body.mode : "auto";
  return { messages, mode, profile: parseProfile(body.profile) };
}

export async function POST(req: Request): Promise<Response> {
  const denied = checkAccess(req);
  if (denied) return denied;

  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return json({ error: "bad_json", message: "Request body must be JSON." }, 400);
  }

  const parsed = parseBody(body);
  if (typeof parsed === "string") return json({ error: "bad_request", message: parsed }, 400);
  const { messages, mode, profile } = parsed;

  // Step 1: pick the model tier (cheap classifier call, or the user's choice).
  const tier = await chooseTier(messages, mode);

  // Step 2: stream the reply as SSE so the UI can show text as it arrives.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const ev of streamModel({
          task: tier === "smart" ? "agent" : "chat",
          tier,
          system: VEE_SYSTEM_PROMPT,
          systemExtra: profile ? profilePrompt(profile) : undefined,
          messages,
          signal: req.signal,
        })) {
          controller.enqueue(sseEvent(ev.type, ev));
        }
      } catch (err) {
        controller.enqueue(sseEvent("error", { message: "Stream failed." }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
