import {
  ASSET_TYPES,
  getCashKind,
  PARTNER_FIELDS,
  PRIVE_INPUT_FIELDS,
  SECTIONS,
  STEPS,
  type AssetTypeDef,
  type FieldDef,
  type Side,
  type StepKey,
} from "./definitions";
import type { AssetRow, PlanConfig, PlanInputs } from "./types";

export interface MissingField {
  side: Side;
  /** Stable id used to highlight the field in the UI. */
  id: string;
  label: string;
}

export function isFieldVisible(field: FieldDef, config: PlanConfig): boolean {
  return field.section === "algemeen" || config.sections[field.section];
}

export function isAssetTypeRelevant(def: AssetTypeDef, config: PlanConfig): boolean {
  return def.sections.some((s) => config.sections[s]);
}

export function sideHasSections(side: Side, config: PlanConfig): boolean {
  return SECTIONS.some((s) => s.side === side && config.sections[s.key]);
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));
}

/** Every required field that is visible under the current configuration but still empty. */
export function findMissingFields(config: PlanConfig, inputs: PlanInputs, assets: AssetRow[]): MissingField[] {
  const missing: MissingField[] = [];

  for (const field of PRIVE_INPUT_FIELDS) {
    if (!field.required || !isFieldVisible(field, config)) continue;
    if (isEmpty(inputs.prive[field.key as keyof typeof inputs.prive])) {
      missing.push({ side: "prive", id: `input.${field.key}`, label: field.label });
    }
  }

  if (config.sections.partner) {
    for (const field of PARTNER_FIELDS) {
      if (!field.required) continue;
      if (isEmpty(inputs.partner[field.key as keyof typeof inputs.partner])) {
        missing.push({ side: "prive", id: `partner.${field.key}`, label: `Partner: ${field.label}` });
      }
    }
  }

  if (config.sections.kinderen) {
    for (const k of inputs.kinderen) {
      if (!k.naam.trim()) missing.push({ side: "prive", id: `kind.${k.id}.naam`, label: "Kind: naam" });
      if (isEmpty(k.geboortejaar)) missing.push({ side: "prive", id: `kind.${k.id}.geboortejaar`, label: `${k.naam || "Kind"}: geboortejaar` });
    }
    for (const g of inputs.schenkingen) {
      const child = inputs.kinderen.find((k) => k.id === g.kindId)?.naam || "Kind";
      if (isEmpty(g.bedrag)) missing.push({ side: "prive", id: `gift.${g.id}.bedrag`, label: `Schenking ${child}: bedrag` });
      if (isEmpty(g.startjaar)) missing.push({ side: "prive", id: `gift.${g.id}.startjaar`, label: `Schenking ${child}: startjaar` });
      if (g.soort === "jaarlijks" && isEmpty(g.jaren)) missing.push({ side: "prive", id: `gift.${g.id}.jaren`, label: `Schenking ${child}: aantal jaren` });
    }
  }

  for (const item of inputs.posten) {
    const kind = getCashKind(item.soort);
    if (!kind || !config.sections[kind.section]) continue;
    const name = item.omschrijving || kind.label;
    if (isEmpty(item.bedrag)) missing.push({ side: "prive", id: `post.${item.id}.bedrag`, label: `${name}: bedrag` });
    if (kind.oneOff && isEmpty(item.startjaar)) missing.push({ side: "prive", id: `post.${item.id}.startjaar`, label: `${name}: jaar` });
  }

  for (const def of ASSET_TYPES) {
    if (!isAssetTypeRelevant(def, config)) continue;
    const rows = assets.filter((a) => a.type === def.type);
    if (rows.length === 0) {
      if (def.requiredRow) missing.push({ side: def.side, id: `type.${def.type}`, label: def.label });
      continue;
    }
    for (const row of rows) {
      if (def.valueField?.required && isEmpty(row.value)) {
        missing.push({ side: def.side, id: `asset.${row.id}.value`, label: `${def.label}: ${def.valueField.label}` });
      }
      // A werkmaatschappij under a holding normally has no pension obligation of its own.
      const viaHolding = def.type === "bv_aandelen" && row.metadata.gehouden_door === "holding";
      for (const field of def.metadataFields) {
        if (!field.required || !isFieldVisible(field, config)) continue;
        if (viaHolding && field.key === "odv_waarde") continue;
        if (isEmpty(row.metadata[field.key])) {
          missing.push({ side: def.side, id: `asset.${row.id}.${field.key}`, label: `${def.label}: ${field.label}` });
        }
      }
    }
  }

  return missing;
}

export type StepState = "complete" | "missing" | "open" | "not_applicable";

export interface StepStatus {
  key: StepKey;
  label: string;
  short: string;
  state: StepState;
  missingCount: number;
}

export function computeStepStatuses(args: {
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  documentCount: number;
  exportCount: number;
}): StepStatus[] {
  const { config, inputs, assets, documentCount, exportCount } = args;
  const missing = findMissingFields(config, inputs, assets);
  const visited = new Set(config.visitedSteps);
  const anySection = Object.values(config.sections).some(Boolean);

  return STEPS.map((step) => {
    let state: StepState = visited.has(step.key) ? "complete" : "open";
    let missingCount = 0;

    switch (step.key) {
      case "configuratie":
        state = anySection ? "complete" : "missing";
        missingCount = anySection ? 0 : 1;
        break;
      case "documenten":
        if (documentCount > 0) state = "complete";
        break;
      case "prive":
      case "zakelijk": {
        if (step.key === "zakelijk" && !sideHasSections("zakelijk", config)) {
          state = "not_applicable";
          break;
        }
        missingCount = missing.filter((m) => m.side === step.key).length;
        if (missingCount > 0 && visited.has(step.key)) state = "missing";
        break;
      }
      case "resultaten":
        break;
      case "rapport":
        state = exportCount > 0 ? "complete" : visited.has("rapport") ? "complete" : "open";
        break;
    }

    return { key: step.key, label: step.label, short: step.short, state, missingCount };
  });
}
