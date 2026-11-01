// Where the AI reader may run. Kept free of server-only imports so it can be unit-tested.

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

/** "eu.anthropic.x" (EU inference profile) or "anthropic.x" (in-region); never global/us/other profiles. */
export function staysInEu(modelId: string): boolean {
  return /^(eu\.)?anthropic\.[a-z0-9.:-]+$/.test(modelId);
}

/**
 * Whether a Bedrock model accepts output_config.effort. Opus 4.5 and later, Sonnet 4.6 and later and
 * Haiku 5 and later do; older models (Haiku 4.5, Sonnet 4.5, ...) reject the request when it is sent.
 */
export function supportsEffort(modelId: string): boolean {
  const m = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d+))?/.exec(modelId);
  if (!m) return false;
  const [, family, majorRaw, minorRaw] = m;
  const major = Number(majorRaw);
  // A second number of 8 digits or more is a date snapshot, not a minor version (claude-opus-4-20250514).
  const minor = minorRaw && minorRaw.length < 3 ? Number(minorRaw) : 0;
  if (family === "fable" || family === "mythos") return true;
  if (major >= 5) return true;
  if (major < 4) return false;
  if (family === "opus") return minor >= 5;
  if (family === "sonnet") return minor >= 6;
  return false;
}

/** output_config with the given effort, or nothing for models that reject it. */
export function effortFor(modelId: string, effort: "low" | "medium" | "high") {
  return supportsEffort(modelId) ? { output_config: { effort } } : {};
}
