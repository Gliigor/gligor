import "server-only";

// Reads an uploaded IB-aangifte or jaarrekening with Claude on Amazon Bedrock
// (bedrock-runtime, EU inference profile; see config.ts). Privacy rules here:
// - only the file itself is sent; no client name, plan data or user data;
// - the model is asked for figures only, never for identifiers such as a BSN;
// - neither the file nor the model's answer is logged.
//
// Bedrock does not offer structured outputs for these models, so the model
// answers by calling a single tool whose input we validate with zod.

import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import type { DocumentType } from "@/lib/plan/types";
import type { ExtractedData } from "../types";
import type { AiReaderConfig } from "./config";
import { mapIbAangifte, mapJaarrekening } from "./map";
import { ibAangifteSchema, jaarrekeningSchema } from "./schema";

const TOOL_NAME = "record_figures";

const SYSTEM = `You read Dutch financial documents for a financial planner and transcribe figures into a fixed structure.

Rules:
- Transcribe exactly what is printed. Do not estimate, extrapolate or calculate; when a value is not in the document, use null.
- Amounts are whole euros. Dutch notation uses a dot for thousands and a comma for decimals ("€ 1.234.567,89" is 1234567.89).
- For every value, give the 1-based page of the uploaded file where it is printed.
- Never output BSN numbers, dates of birth beyond the year, addresses, account numbers or other identifiers.
- Use the notes for anything the planner should check (illegible values, items that do not fit, a consolidated vs. company-only balance sheet). Write notes in Dutch, briefly.
- Answer only by calling the ${TOOL_NAME} tool, exactly once.`;

const TASK: Record<DocumentType, string> = {
  ib_aangifte: `This is a Dutch income tax return (aangifte inkomstenbelasting), possibly including a fiscal partner. Extract personal data (birth years, first name of the partner), box 1 wages per payer, the eigen woning and each loan part of the eigenwoningschuld, every box 3 item with its owner, and box 2 substantial interests.`,
  jaarrekening: `This is the annual report (jaarrekening) of a Dutch BV. Extract balance-sheet and profit-and-loss figures of the company itself (enkelvoudig) when both consolidated and company-only figures are present, and say which one you used in the notes.`,
};

const SCHEMAS = { ib_aangifte: ibAangifteSchema, jaarrekening: jaarrekeningSchema } as const;

function toolFor(type: DocumentType): Anthropic.Tool {
  const schema = z.toJSONSchema(SCHEMAS[type]) as Record<string, unknown>;
  delete schema.$schema;
  return {
    name: TOOL_NAME,
    description: "Record the figures transcribed from the document.",
    input_schema: schema as Anthropic.Tool.InputSchema,
  };
}

let cached: { key: string; client: AnthropicBedrock } | null = null;

function clientFor(config: AiReaderConfig): AnthropicBedrock {
  const key = JSON.stringify([config.region, config.credentials]);
  if (cached?.key === key) return cached.client;
  const common = { awsRegion: config.region, timeout: 240_000, maxRetries: 1 };
  const client =
    "apiKey" in config.credentials
      ? new AnthropicBedrock({ ...common, apiKey: config.credentials.apiKey })
      : new AnthropicBedrock({
          ...common,
          awsAccessKey: config.credentials.accessKeyId,
          awsSecretKey: config.credentials.secretAccessKey,
        });
  cached = { key, client };
  return client;
}

export class ExtractionError extends Error {}

export async function extractWithBedrock(config: AiReaderConfig, file: File, type: DocumentType): Promise<ExtractedData> {
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const source: Anthropic.ContentBlockParam =
    file.type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: file.type === "image/png" ? "image/png" : "image/jpeg", data } };

  const client = clientFor(config);
  const request = (model: string) =>
    client.messages.create({
      model,
      max_tokens: 16_000,
      system: SYSTEM,
      tools: [toolFor(type)],
      tool_choice: { type: "auto" },
      output_config: { effort: "high" },
      messages: [{ role: "user", content: [source, { type: "text", text: TASK[type] }] }],
    });

  let res = await request(config.model);
  // Client-side fallback: if the main model declines, ask the fallback model once.
  if (res.stop_reason === "refusal" && config.fallbackModel) res = await request(config.fallbackModel);

  if (res.stop_reason === "refusal") throw new ExtractionError("refusal");
  if (res.stop_reason === "max_tokens") throw new ExtractionError("max_tokens");
  const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === TOOL_NAME);
  if (!call) throw new ExtractionError("no_tool_call");

  if (type === "ib_aangifte") {
    const parsed = ibAangifteSchema.safeParse(call.input);
    if (!parsed.success) throw new ExtractionError("invalid_output");
    return mapIbAangifte(parsed.data);
  }
  const parsed = jaarrekeningSchema.safeParse(call.input);
  if (!parsed.success) throw new ExtractionError("invalid_output");
  return mapJaarrekening(parsed.data);
}
