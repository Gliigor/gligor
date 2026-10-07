/**
 * POST /api/login
 *
 * Checks the access code from the login screen so a wrong code is caught
 * right away instead of on the first chat message. Uses the same
 * `x-vee-access` header as /api/chat.
 *
 * Reply: { ok: true } or 401 { error: "access_code_required" }.
 */
import { checkAccess, json } from "./_lib/http.js";

export function POST(req: Request): Response {
  const denied = checkAccess(req);
  if (denied) return denied;
  return json({ ok: true });
}
