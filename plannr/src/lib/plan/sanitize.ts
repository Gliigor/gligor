// Validation of values coming from the browser before they are stored.

import { getAssetType, PRIVE_INPUT_FIELDS, type FieldDef } from "./definitions";
import type { AssetMetadata, PriveInputs } from "./types";

const MAX_AMOUNT = 1e12;

export function sanitizeFieldValue(field: FieldDef, raw: unknown): number | string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  switch (field.kind) {
    case "money":
    case "percent":
    case "integer": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || Math.abs(n) > MAX_AMOUNT) return null;
      if (field.kind === "integer") return Math.round(n);
      if (field.kind === "percent") return Math.round(n * 1000) / 1000;
      return Math.round(n * 100) / 100;
    }
    case "select":
      return typeof raw === "string" && field.options?.some((o) => o.value === raw) ? raw : null;
    case "text":
      return typeof raw === "string" ? raw.trim().slice(0, 200) : null;
  }
}

export function sanitizePriveInputs(raw: unknown): PriveInputs {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of PRIVE_INPUT_FIELDS) out[field.key] = sanitizeFieldValue(field, obj[field.key]);
  return out as PriveInputs;
}

export function sanitizeKeyList(raw: unknown, allowed: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((k): k is string => typeof k === "string" && allowed.includes(k)))];
}

export function sanitizeAssetPatch(type: string, patch: { label?: unknown; value?: unknown; metadata?: unknown }) {
  const def = getAssetType(type);
  if (!def) throw new Error("Onbekend type");
  const rawMeta = (typeof patch.metadata === "object" && patch.metadata !== null ? patch.metadata : {}) as Record<string, unknown>;
  const metadata: AssetMetadata = {};
  for (const field of def.metadataFields) metadata[field.key] = sanitizeFieldValue(field, rawMeta[field.key]);
  metadata._fromDocument = sanitizeKeyList(rawMeta._fromDocument, ["value", ...def.metadataFields.map((f) => f.key)]);

  const valueField: FieldDef = { key: "value", label: "", kind: "money", section: "algemeen" };
  let value = sanitizeFieldValue(valueField, patch.value) as number | null;
  if (!def.valueField && type === "bv_aandelen") {
    // Derived: indicative value of the shares.
    const equity = typeof metadata.eigen_vermogen === "number" ? metadata.eigen_vermogen : null;
    const pct = typeof metadata.aandelen_percentage === "number" ? metadata.aandelen_percentage : null;
    value = equity !== null && pct !== null ? Math.round(equity * pct) / 100 : null;
  }
  const label = typeof patch.label === "string" ? patch.label.trim().slice(0, 200) : "";
  return { label, value, metadata };
}
