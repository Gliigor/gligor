import {
  ASSET_TYPES,
  getCashKind,
  PARTNER_FIELDS,
  PARTNER_INCOME_FIELDS,
  PRIVE_FIELD_STEP,
  PRIVE_INPUT_FIELDS,
  SECTIONS,
  stepOfAssetType,
  STEPS,
  type AssetTypeDef,
  type FieldDef,
  type Side,
  type StepKey,
} from "./definitions";
import type { AssetRow, PlanConfig, PlanInputs } from "./types";

export interface MissingField {
  side: Side;
  /** The step where this field is filled in. */
  step: StepKey;
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
      missing.push({ side: "prive", step: PRIVE_FIELD_STEP[field.key] ?? "gezin", id: `input.${field.key}`, label: field.label });
    }
  }

  if (config.sections.partner) {
    for (const field of PARTNER_FIELDS) {
      if (!field.required) continue;
      if (isEmpty(inputs.partner[field.key as keyof typeof inputs.partner])) {
        missing.push({ side: "prive", step: PARTNER_INCOME_FIELDS.includes(field.key) ? "inkomen" : "gezin", id: `partner.${field.key}`, label: `Partner: ${field.label}` });
      }
    }
  }

  if (config.sections.kinderen) {
    for (const k of inputs.kinderen) {
      if (!k.naam.trim()) missing.push({ side: "prive", step: "gezin", id: `kind.${k.id}.naam`, label: "Kind: naam" });
      if (isEmpty(k.geboortejaar)) missing.push({ side: "prive", step: "gezin", id: `kind.${k.id}.geboortejaar`, label: `${k.naam || "Kind"}: geboortejaar` });
    }
    for (const g of inputs.schenkingen) {
      const child = inputs.kinderen.find((k) => k.id === g.kindId)?.naam || "Kind";
      if (isEmpty(g.bedrag)) missing.push({ side: "prive", step: "gezin", id: `gift.${g.id}.bedrag`, label: `Schenking ${child}: bedrag` });
      if (isEmpty(g.startjaar)) missing.push({ side: "prive", step: "gezin", id: `gift.${g.id}.startjaar`, label: `Schenking ${child}: startjaar` });
      if (g.soort === "jaarlijks" && isEmpty(g.jaren)) missing.push({ side: "prive", step: "gezin", id: `gift.${g.id}.jaren`, label: `Schenking ${child}: aantal jaren` });
    }
  }

  for (const item of inputs.posten) {
    const kind = getCashKind(item.soort);
    if (!kind || !config.sections[kind.section]) continue;
    const name = item.omschrijving || kind.label;
    if (isEmpty(item.bedrag)) missing.push({ side: "prive", step: "inkomen", id: `post.${item.id}.bedrag`, label: `${name}: bedrag` });
    if (kind.oneOff && isEmpty(item.startjaar)) missing.push({ side: "prive", step: "inkomen", id: `post.${item.id}.startjaar`, label: `${name}: jaar` });
  }

  for (const def of ASSET_TYPES) {
    if (!isAssetTypeRelevant(def, config)) continue;
    const rows = assets.filter((a) => a.type === def.type);
    if (rows.length === 0) {
      if (def.requiredRow) missing.push({ side: def.side, step: stepOfAssetType(def), id: `type.${def.type}`, label: def.label });
      continue;
    }
    for (const row of rows) {
      if (def.valueField?.required && isEmpty(row.value)) {
        missing.push({ side: def.side, step: stepOfAssetType(def), id: `asset.${row.id}.value`, label: `${def.label}: ${def.valueField.label}` });
      }
      // A werkmaatschappij under a holding normally has no pension obligation of its own.
      const viaHolding = def.type === "bv_aandelen" && row.metadata.gehouden_door === "holding";
      for (const field of def.metadataFields) {
        if (!field.required || !isFieldVisible(field, config)) continue;
        if (viaHolding && field.key === "odv_waarde") continue;
        if (isEmpty(row.metadata[field.key])) {
          missing.push({ side: def.side, step: stepOfAssetType(def), id: `asset.${row.id}.${field.key}`, label: `${def.label}: ${field.label}` });
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

/** Zakelijk is a step only for clients with a company (or plans that already have business data). */
export function hasZakelijkStep(config: PlanConfig, hasCompany: boolean): boolean {
  return hasCompany || sideHasSections("zakelijk", config);
}

export function computeStepStatuses(args: {
  config: PlanConfig;
  inputs: PlanInputs;
  assets: AssetRow[];
  documentCount: number;
  exportCount: number;
  hasCompany: boolean;
}): StepStatus[] {
  const { config, inputs, assets, documentCount, exportCount, hasCompany } = args;
  const missing = findMissingFields(config, inputs, assets);
  const visited = new Set(config.visitedSteps);

  return STEPS.filter((step) => step.key !== "zakelijk" || hasZakelijkStep(config, hasCompany)).map((step) => {
    let state: StepState = visited.has(step.key) ? "complete" : "open";
    let missingCount = 0;

    switch (step.key) {
      case "documenten":
        if (documentCount > 0) state = "complete";
        break;
      case "resultaten":
        break;
      case "rapport":
        state = exportCount > 0 ? "complete" : visited.has("rapport") ? "complete" : "open";
        break;
      default:
        missingCount = missing.filter((m) => m.step === step.key).length;
        if (missingCount > 0 && visited.has(step.key)) state = "missing";
    }

    return { key: step.key, label: step.label, short: step.short, state, missingCount };
  });
}
