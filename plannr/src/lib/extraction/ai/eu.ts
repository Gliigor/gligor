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
