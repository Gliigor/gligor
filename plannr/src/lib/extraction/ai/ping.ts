import "server-only";

// Connection test for Instellingen: asks every configured model for a one-word
// answer, so an owner can see whether the AWS setup works before switching the
// reader on. No document or client data is sent.

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";
import type { AiReaderConfig } from "./config";
import { effortFor } from "./eu";

export interface PingResult {
  role: string;
  model: string;
  ok: boolean;
  /** Dutch explanation of what to fix; null when ok. */
  message: string | null;
}

/** Turns an AWS/Bedrock error into a plain Dutch hint (AWS messages contain no secrets). */
export function explainBedrockError(error: unknown): string {
  const e = error as { status?: number; message?: string };
  const raw = (e.message ?? String(error)).replace(/\s+/g, " ").slice(0, 220);
  const status = e.status;
  if (/security token|UnrecognizedClient|signature|invalid api key|authentication/i.test(raw) || status === 401)
    return `De toegangssleutel wordt niet herkend. Controleer de sleutel in Vercel. (${raw})`;
  if (/model access|don't have access|not authorized|AccessDenied/i.test(raw) || status === 403)
    return `Geen toegang tot dit model. Vraag in Bedrock modeltoegang aan voor Anthropic, en controleer dat de gebruiker bedrock:InvokeModel mag. (${raw})`;
  if (/model identifier is invalid|not found|inference profile/i.test(raw) || status === 404)
    return `Dit model is niet beschikbaar vanuit deze regio. Kies een andere EU-regio of een ander model. (${raw})`;
  if (/throttl|too many|quota/i.test(raw) || status === 429) return `AWS beperkt het aantal verzoeken. Probeer het over een minuut opnieuw. (${raw})`;
  return raw;
}

export async function pingBedrock(config: AiReaderConfig): Promise<PingResult[]> {
  const common = { awsRegion: config.region, timeout: 30_000, maxRetries: 0 };
  const client =
    "apiKey" in config.credentials
      ? new AnthropicBedrock({ ...common, apiKey: config.credentials.apiKey })
      : new AnthropicBedrock({ ...common, awsAccessKey: config.credentials.accessKeyId, awsSecretKey: config.credentials.secretAccessKey });
  const models = [
    { role: "Lezer", model: config.model },
    ...(config.checkModel ? [{ role: "Tweede lezing", model: config.checkModel }] : []),
  ];
  return Promise.all(
    models.map(async ({ role, model }) => {
      try {
        // Same request shape as a real reading (effort where the model supports it).
        await client.messages.create({ model, max_tokens: 16, ...effortFor(model, "low"), messages: [{ role: "user", content: "Antwoord alleen met: OK" }] });
        return { role, model, ok: true, message: null };
      } catch (error) {
        return { role, model, ok: false, message: explainBedrockError(error) };
      }
    }),
  );
}
