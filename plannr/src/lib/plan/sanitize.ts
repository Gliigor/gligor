// Validation of values coming from the browser before they are stored.

import { expenseTotal, usesCategories } from "./expenses";
import { getAssetType, getCashKind, PARTNER_FIELDS, PRIVE_INPUT_FIELDS, type FieldDef } from "./definitions";
import { applyBvDerivations } from "./bv";
import { parsePlanInputs, type AssetMetadata, type PartnerInputs, type PlanInputs, type PriveInputs } from "./types";

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

export function sanitizePartnerInputs(raw: unknown): PartnerInputs {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const field of PARTNER_FIELDS) out[field.key] = sanitizeFieldValue(field, obj[field.key]);
  return out as PartnerInputs;
}

const clamp = (v: number | null, min: number, max: number) => (v === null ? null : Math.min(max, Math.max(min, Math.round(v))));

/** Validates everything the privé step can save in plans.inputs. */
export function sanitizePlanInputs(raw: unknown): PlanInputs {
  const result = sanitizeInputsOnly(raw);
  // With categories, the yearly total is always their sum.
  if (usesCategories(result.uitgaven)) result.prive.jaarlijkse_uitgaven = expenseTotal(result.uitgaven);
  return result;
}

function sanitizeInputsOnly(raw: unknown): PlanInputs {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const parsed = parsePlanInputs(obj);
  const allowedDocKeys = [...PRIVE_INPUT_FIELDS.map((f) => f.key), ...PARTNER_FIELDS.map((f) => `partner.${f.key}`)];
  const pat = parsed.uitgangspunten.uitgavenpatroon;
  const pct = (v: number | null) => (v === null ? null : Math.min(200, Math.max(0, Math.round(v))));
  return {
    uitgangspunten: {
      rendement: parsed.uitgangspunten.rendement,
      uitgavenpatroon: { pensioenPct: pct(pat.pensioenPct), laterLeeftijd: clamp(pat.laterLeeftijd, 50, 110), laterPct: pct(pat.laterPct) },
    },
    prive: sanitizePriveInputs(obj.prive),
    // Yearly amounts per category, whole euros.
    uitgaven: Object.fromEntries(
      Object.entries(parsed.uitgaven).map(([k, v]) => [k, v === null || v === undefined ? null : Math.min(MAX_AMOUNT, Math.max(0, Math.round(v)))]),
    ),
    partner: sanitizePartnerInputs(obj.partner),
    kinderen: parsed.kinderen.map((k) => ({ ...k, naam: k.naam.trim(), geboortejaar: clamp(k.geboortejaar, 1900, 2100) })),
    schenkingen: parsed.schenkingen.map((g) => ({
      ...g,
      bedrag: g.bedrag === null ? null : Math.min(MAX_AMOUNT, Math.max(0, Math.round(g.bedrag * 100) / 100)),
      startjaar: clamp(g.startjaar, 1990, 2100),
      jaren: clamp(g.jaren, 1, 50),
    })),
    posten: parsed.posten.map((x) => {
      const kind = getCashKind(x.soort);
      const startjaar = clamp(x.startjaar, 1990, 2150);
      const eindjaar = kind?.oneOff ? null : clamp(x.eindjaar, 1990, 2150);
      return {
        ...x,
        omschrijving: x.omschrijving.trim(),
        // Household items have no person; personal items default to the client.
        persoon: kind?.perPerson ? (x.persoon ?? "client") : null,
        bedrag: x.bedrag === null ? null : Math.min(MAX_AMOUNT, Math.max(0, Math.round(x.bedrag * 100) / 100)),
        startjaar,
        eindjaar: eindjaar !== null && startjaar !== null && eindjaar < startjaar ? startjaar : eindjaar,
        groei: x.groei === null ? null : Math.min(20, Math.max(-20, Math.round(x.groei * 100) / 100)),
      };
    }),
    fromDocument: sanitizeKeyList(obj.fromDocument, allowedDocKeys),
  };
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
  const owner = rawMeta.eigenaar;
  if (owner === "client" || owner === "partner" || owner === "joint") metadata.eigenaar = owner;
  if (type === "bv_aandelen") {
    if (rawMeta.uitgebreid === "ja") metadata.uitgebreid = "ja";
    Object.assign(metadata, applyBvDerivations(metadata));
  }

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
