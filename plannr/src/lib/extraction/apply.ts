// Turns ExtractedData into concrete changes for a plan, respecting the plan
// configuration: values only land in sections that were checked in step 1.

import { getAssetType, PRIVE_INPUT_FIELDS } from "@/lib/plan/definitions";
import { isAssetTypeRelevant, isFieldVisible } from "@/lib/plan/status";
import type { AssetMetadata, AssetRow, PlanConfig, PlanInputs } from "@/lib/plan/types";
import type { ExtractedData } from "./types";

export interface ExtractionChanges {
  inputs: PlanInputs | null;
  updates: { id: string; label: string; value: number | null; metadata: AssetMetadata }[];
  inserts: { type: string; label: string; value: number | null; metadata: AssetMetadata }[];
  appliedCount: number;
}

export function planExtractionChanges(
  data: ExtractedData,
  config: PlanConfig,
  inputs: PlanInputs,
  assets: AssetRow[],
): ExtractionChanges {
  let appliedCount = 0;

  // Privé inputs
  let nextInputs: PlanInputs | null = null;
  for (const field of PRIVE_INPUT_FIELDS) {
    const v = data.prive[field.key as keyof typeof data.prive];
    if (v === undefined || !isFieldVisible(field, config)) continue;
    nextInputs ??= { prive: { ...inputs.prive }, fromDocument: [...inputs.fromDocument] };
    (nextInputs.prive as Record<string, unknown>)[field.key] = v;
    if (!nextInputs.fromDocument.includes(field.key)) nextInputs.fromDocument.push(field.key);
    appliedCount++;
  }

  const updates: ExtractionChanges["updates"] = [];
  const inserts: ExtractionChanges["inserts"] = [];

  const claimed = new Set<string>();
  const isEmptyRow = (a: AssetRow) =>
    a.value === null && a.label === "" && Object.entries(a.metadata).every(([k, v]) => k === "_fromDocument" || v === null || v === "");

  for (const found of data.assets) {
    const def = getAssetType(found.type);
    if (!def || !isAssetTypeRelevant(def, config)) continue;

    const visibleMeta = Object.entries(found.metadata ?? {}).filter(([key]) => {
      const f = def.metadataFields.find((m) => m.key === key);
      return f && isFieldVisible(f, config);
    });
    const hasValue = found.value !== undefined && Boolean(def.valueField);
    if (!hasValue && visibleMeta.length === 0) continue;

    const existing = def.multiple
      ? (assets.find((a) => a.type === def.type && !claimed.has(a.id) && a.label === (found.label ?? "")) ??
        assets.find((a) => a.type === def.type && !claimed.has(a.id) && isEmptyRow(a)))
      : assets.find((a) => a.type === def.type);
    if (existing) claimed.add(existing.id);

    const metadata: AssetMetadata = { ...(existing?.metadata ?? {}) };
    const fromDoc = new Set(existing?.metadata._fromDocument ?? []);
    for (const [key, v] of visibleMeta) {
      metadata[key] = v;
      fromDoc.add(key);
      appliedCount++;
    }
    let value = existing?.value ?? null;
    if (hasValue) {
      value = found.value!;
      fromDoc.add("value");
      appliedCount++;
    }
    metadata._fromDocument = [...fromDoc];
    const label = found.label ?? existing?.label ?? "";

    if (existing) updates.push({ id: existing.id, label, value, metadata });
    else inserts.push({ type: def.type, label, value, metadata });
  }

  return { inputs: nextInputs, updates, inserts, appliedCount };
}
