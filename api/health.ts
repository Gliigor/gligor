/**
 * GET /api/health
 *
 * Quick way to check the backend is deployed and configured.
 * Never reveals the key itself, only whether one is present.
 */
import { isMockMode, isUnavailable } from "./_lib/model.js";
import { MODEL_IDS } from "./_lib/models.js";
import { json } from "./_lib/http.js";

export function GET(): Response {
  return json({
    ok: true,
    mock: isMockMode(),
    unavailable: isUnavailable(),
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    accessCodeRequired: Boolean(process.env.VEE_ACCESS_CODE),
    models: MODEL_IDS,
  });
}
