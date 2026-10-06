/**
 * GET /api/health
 *
 * Quick way to check the backend is deployed and configured.
 * Never reveals the key itself, only whether one is present.
 */
import { isMockMode } from "./_lib/model";
import { MODEL_IDS } from "./_lib/models";
import { json } from "./_lib/http";

export function GET(): Response {
  return json({
    ok: true,
    mock: isMockMode(),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    accessCodeRequired: Boolean(process.env.VEE_ACCESS_CODE),
    models: MODEL_IDS,
  });
}
