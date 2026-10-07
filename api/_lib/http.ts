/**
 * Small helpers shared by the API endpoints: JSON responses, access-code
 * check, and a Server-Sent-Events (SSE) writer for streaming replies.
 */

export function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extraHeaders },
  });
}

/**
 * Optional gate for the public tryout. If VEE_ACCESS_CODE is set on the
 * server, the browser must send the same value in the `x-vee-access` header.
 * This is not real authentication (Phase 3 adds sign-in); it just stops
 * strangers from spending your API budget in the meantime.
 */
export function checkAccess(req: Request): Response | null {
  const required = process.env.VEE_ACCESS_CODE;
  if (!required) return null;
  const given = req.headers.get("x-vee-access") ?? "";
  if (given === required) return null;
  return json({ error: "access_code_required", message: "Enter the access code to use Vee." }, 401);
}

/** Encodes one SSE event: `event: <name>\ndata: <json>\n\n`. */
export function sseEvent(name: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};
