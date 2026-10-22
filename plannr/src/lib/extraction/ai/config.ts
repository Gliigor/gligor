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
// PLANNR_BEDROCK_MODEL                optional, default eu.anthropic.claude-sonnet-5-5
// PLANNR_BEDROCK_CHECK_MODEL          optional, reads a document again when our checks on the
//                                     first reading fail; default eu.anthropic.claude-opus-5-5,
//                                     "none" to disable
// PLANNR_BEDROCK_FALLBACK_MODEL       optional, used only if a model declines;
//                                     default eu.anthropic.claude-opus-4-8, "none" to disable
//
// Model IDs must use the "eu." inference profile (processing stays inside
// AWS's EU geography) or no profile prefix (in-region). "global.", "us." and
// other profiles are refused.
//
// PLANNR_DESIGN_MODEL                 optional, model of the report designer (Instellingen →
//                                     Huisstijl); default eu.anthropic.claude-opus-5-5
//
// The PLANNR_ prefix matters: Vercel reserves AWS_REGION and the AWS_* keys.

export interface AiReaderConfig {
  region: string;
  model: string;
  /** Stronger model for a second reading when the checks on the first one fail. */
  checkModel: string | null;
  fallbackModel: string | null;
  credentials: { apiKey: string } | { accessKeyId: string; secretAccessKey: string };
}

export type AiReaderStatus = { configured: true; config: AiReaderConfig } | { configured: false; reason: string };

export interface AiDesignerConfig {
  region: string;
  model: string;
  credentials: AiReaderConfig["credentials"];
}

export type AiDesignerStatus = { configured: true; config: AiDesignerConfig } | { configured: false; reason: string };

/** The report designer uses the same Bedrock access as the reader, with its own model. */
export function getAiDesignerStatus(): AiDesignerStatus {
  const reader = getAiReaderStatus();
  if (!reader.configured) return reader;
  const model = (process.env.PLANNR_DESIGN_MODEL || "eu.anthropic.claude-opus-5-5").trim();
  if (!staysInEu(model)) return { configured: false, reason: "Het ingestelde AI-model valt buiten het EU-profiel." };
  return { configured: true, config: { region: reader.config.region, model, credentials: reader.config.credentials } };
}

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

  const model = (env.PLANNR_BEDROCK_MODEL || "eu.anthropic.claude-sonnet-5-5").trim();
  const optional = (raw: string | undefined, fallback: string) => {
    const value = (raw || fallback).trim();
    return value === "none" ? null : value;
  };
  const checkModel = optional(env.PLANNR_BEDROCK_CHECK_MODEL, "eu.anthropic.claude-opus-5-5");
  const fallbackModel = optional(env.PLANNR_BEDROCK_FALLBACK_MODEL, "eu.anthropic.claude-opus-4-8");
  if ([model, checkModel, fallbackModel].some((m) => m !== null && !staysInEu(m))) {
    return { configured: false, reason: "Het ingestelde AI-model valt buiten het EU-profiel." };
  }
  return { configured: true, config: { region, model, checkModel, fallbackModel, credentials } };
}
