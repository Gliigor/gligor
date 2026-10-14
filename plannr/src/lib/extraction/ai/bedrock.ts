import "server-only";

// Reads an uploaded IB-aangifte or jaarrekening with Claude on Amazon Bedrock,
// in an EU region (see config.ts). Privacy rules for this file:
// - only the file itself is sent; no client name, plan data or user data;
// - the model is asked for figures only, never for identifiers such as a BSN;
// - neither the file nor the model's answer is logged.

import { betaRefusalFallbackMiddleware } from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrockMantle } from "@anthropic-ai/bedrock-sdk";
import type { DocumentType } from "@/lib/plan/types";
import type { ExtractedData } from "../types";
import type { AiReaderConfig } from "./config";
import { mapIbAangifte, mapJaarrekening } from "./map";
import { ibAangifteSchema, jaarrekeningSchema } from "./schema";

const SYSTEM = `You read Dutch financial documents for a financial planner and transcribe figures into a fixed structure.

Rules:
- Transcribe exactly what is printed. Do not estimate, extrapolate or calculate; when a value is not in the document, return null.
- Amounts are whole euros. Dutch notation uses a dot for thousands and a comma for decimals ("€ 1.234.567,89" is 1234567.89).
- For every value, give the 1-based page of the uploaded file where it is printed.
- Never output BSN numbers, dates of birth beyond the year, addresses, account numbers or other identifiers.
- Use the notes for anything the planner should check (illegible values, items that do not fit, a consolidated vs. company-only balance sheet). Write notes in Dutch, briefly.`;

const TASK: Record<DocumentType, string> = {
  ib_aangifte: `This is a Dutch income tax return (aangifte inkomstenbelasting), possibly including a fiscal partner. Extract personal data (birth years, first name of the partner), box 1 wages per payer, the eigen woning and each loan part of the eigenwoningschuld, every box 3 item with its owner, and box 2 substantial interests.`,
  jaarrekening: `This is the annual report (jaarrekening) of a Dutch BV. Extract balance-sheet and profit-and-loss figures of the company itself (enkelvoudig) when both consolidated and company-only figures are present, and say which one you used in the notes.`,
};

let cached: { key: string; client: AnthropicBedrockMantle } | null = null;

function clientFor(config: AiReaderConfig): AnthropicBedrockMantle {
  const key = JSON.stringify([config.region, config.fallbackModel, config.credentials]);
  if (cached?.key === key) return cached.client;
  const auth =
    "apiKey" in config.credentials
      ? { apiKey: config.credentials.apiKey }
      : { awsAccessKey: config.credentials.accessKeyId, awsSecretAccessKey: config.credentials.secretAccessKey };
  const client = new AnthropicBedrockMantle({
    awsRegion: config.region,
    ...auth,
    timeout: 240_000,
    maxRetries: 1,
    // Only used if the main model declines the request. The middleware acts
    // on the beta messages endpoint, hence client.beta.messages below.
    middleware: config.fallbackModel ? [betaRefusalFallbackMiddleware([{ model: config.fallbackModel }])] : [],
  });
  cached = { key, client };
  return client;
}

export class ExtractionError extends Error {}

export async function extractWithBedrock(config: AiReaderConfig, file: File, type: DocumentType): Promise<ExtractedData> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source: Anthropic.Beta.BetaContentBlockParam =
    file.type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.type === "image/png" ? "image/png" : "image/jpeg", data } };

  const client = clientFor(config);
  const common = {
    model: config.model,
    max_tokens: 16_000,
    system: SYSTEM,
    messages: [{ role: "user" as const, content: [source, { type: "text" as const, text: TASK[type] }] }],
  };

  if (type === "ib_aangifte") {
    const res = await client.beta.messages.parse({
      ...common,
      output_config: { effort: "high", format: betaZodOutputFormat(ibAangifteSchema) },
    });
    return mapIbAangifte(checked(res));
  }
  const res = await client.beta.messages.parse({
    ...common,
    output_config: { effort: "high", format: betaZodOutputFormat(jaarrekeningSchema) },
  });
  return mapJaarrekening(checked(res));
}

function checked<T>(res: { stop_reason: string | null; parsed_output: T | null }): T {
  if (res.stop_reason === "refusal") throw new ExtractionError("refusal");
  if (res.stop_reason === "max_tokens") throw new ExtractionError("max_tokens");
  if (res.parsed_output === null) throw new ExtractionError("unparsed");
  return res.parsed_output;
}
