import "server-only";

import { EU_REGIONS, staysInEu } from "./eu";

export { EU_REGIONS };

// Server-side configuration of the AI document reader. Everything comes from
// environment variables; nothing is configurable from the browser.
//
// PLANNR_AI_READER=bedrock            turns the reader on for this deployment
// PLANNR_AWS_REGION=eu-central-1      region the request enters AWS (EU_REGIONS, enforced)
// PLANNR_BEDROCK_API_KEY=...          a Bedrock API key, or alternatively:
// PLANNR_AWS_ACCESS_KEY_ID / PLANNR_AWS_SECRET_ACCESS_KEY
// PLANNR_BEDROCK_MODEL                optional, default eu.anthropic.claude-opus-5-5
// PLANNR_BEDROCK_FALLBACK_MODEL       optional, used only if the main model declines;
//                                     default eu.anthropic.claude-opus-4-8, "none" to disable
//
// Model IDs must use the "eu." inference profile (processing stays inside
// AWS's EU geography) or no profile prefix (in-region). "global.", "us." and
// other profiles are refused.
//
// The PLANNR_ prefix matters: Vercel reserves AWS_REGION and the AWS_* keys.

export interface AiReaderConfig {
  region: string;
  model: string;
  fallbackModel: string | null;
  credentials: { apiKey: string } | { accessKeyId: string; secretAccessKey: string };
}

export type AiReaderStatus = { configured: true; config: AiReaderConfig } | { configured: false; reason: string };

export function getAiReaderStatus(): AiReaderStatus {
  const env = process.env;
  if (env.PLANNR_AI_READER !== "bedrock") return { configured: false, reason: "De AI-lezer is op deze server niet ingeschakeld." };

  const region = (env.PLANNR_AWS_REGION ?? "eu-central-1").trim();
  // AVG: documents may only be processed inside the EU.
  if (!Object.hasOwn(EU_REGIONS, region)) return { configured: false, reason: "De AI-lezer is alleen toegestaan in een EU-regio." };

  let credentials: AiReaderConfig["credentials"] | null = null;
  if (env.PLANNR_BEDROCK_API_KEY) credentials = { apiKey: env.PLANNR_BEDROCK_API_KEY };
  else if (env.PLANNR_AWS_ACCESS_KEY_ID && env.PLANNR_AWS_SECRET_ACCESS_KEY)
    credentials = { accessKeyId: env.PLANNR_AWS_ACCESS_KEY_ID, secretAccessKey: env.PLANNR_AWS_SECRET_ACCESS_KEY };
  if (!credentials) return { configured: false, reason: "De toegangssleutel voor de AI-lezer ontbreekt op de server." };

  const model = (env.PLANNR_BEDROCK_MODEL || "eu.anthropic.claude-opus-5-5").trim();
  const fallback = (env.PLANNR_BEDROCK_FALLBACK_MODEL || "eu.anthropic.claude-opus-4-8").trim();
  const fallbackModel = fallback === "none" ? null : fallback;
  if (!staysInEu(model) || (fallbackModel && !staysInEu(fallbackModel))) {
    return { configured: false, reason: "Het ingestelde AI-model valt buiten het EU-profiel." };
  }
  return { configured: true, config: { region, model, fallbackModel, credentials } };
}
