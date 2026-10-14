import "server-only";

// Server-side configuration of the AI document reader. Everything comes from
// environment variables; nothing is configurable from the browser.
//
// PLANNR_AI_READER=bedrock            turns the reader on for this deployment
// PLANNR_AWS_REGION=eu-central-1      must be an EU region (EU_REGIONS, enforced below)
// PLANNR_BEDROCK_API_KEY=...          a Bedrock API key, or alternatively:
// PLANNR_AWS_ACCESS_KEY_ID / PLANNR_AWS_SECRET_ACCESS_KEY
// PLANNR_BEDROCK_MODEL                optional, default anthropic.claude-opus-5-5
// PLANNR_BEDROCK_FALLBACK_MODEL       optional, used only if the main model declines;
//                                     default anthropic.claude-opus-4-8, "none" to disable
//
// The PLANNR_ prefix matters: Vercel reserves AWS_REGION and the AWS_* keys.

// AWS regions inside the EU. Not every "eu-" region qualifies: eu-west-2 is
// London and eu-central-2 is Zürich.
export const EU_REGIONS: Record<string, string> = {
  "eu-central-1": "Frankfurt",
  "eu-west-1": "Ierland",
  "eu-west-3": "Parijs",
  "eu-north-1": "Stockholm",
  "eu-south-1": "Milaan",
  "eu-south-2": "Spanje",
};

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

  const fallback = (env.PLANNR_BEDROCK_FALLBACK_MODEL ?? "anthropic.claude-opus-4-8").trim();
  return {
    configured: true,
    config: {
      region,
      model: (env.PLANNR_BEDROCK_MODEL ?? "anthropic.claude-opus-5-5").trim(),
      fallbackModel: fallback && fallback !== "none" ? fallback : null,
      credentials,
    },
  };
}
