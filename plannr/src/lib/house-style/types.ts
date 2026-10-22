import type { LayoutVariant } from "@/lib/plan/types";
import { isFontName } from "./fonts";

/** Report building blocks. Content, numbers and charts are the same in every combination. */
export type CoverBlock = "kader" | "kleurvlak" | "zijbalk" | "licht";
export type OpenerBlock = "lijn" | "balk" | "hoofdstuk" | "nummer";
export type PanelBlock = "papier" | "tint" | "kader";

export interface DesignBlocks {
  cover: CoverBlock;
  opener: OpenerBlock;
  panel: PanelBlock;
}

export const COVER_BLOCKS: { key: CoverBlock; label: string; description: string }[] = [
  { key: "kader", label: "Kader", description: "Volledig gekleurde voorpagina met een dunne lijst, alles gecentreerd. Klassiek en formeel." },
  { key: "kleurvlak", label: "Kleurvlak", description: "Groot kleurvlak met cirkels in de accentkleuren boven, gegevens eronder. Modern en uitgesproken." },
  { key: "zijbalk", label: "Zijbalk", description: "Smalle gekleurde balk links met logo, titel op wit. Rustig en zakelijk." },
  { key: "licht", label: "Licht", description: "Witte voorpagina, logo bovenaan, grote titel met een fijne accentlijn. Luchtig en verfijnd." },
];

export const OPENER_BLOCKS: { key: OpenerBlock; label: string; description: string }[] = [
  { key: "lijn", label: "Lijn", description: "Nummer en titel met een doorlopende lijn eronder." },
  { key: "balk", label: "Balk", description: "Titel in een gekleurde balk met het nummer in de accentkleur." },
  { key: "hoofdstuk", label: "Hoofdstuk", description: "Klein 'Hoofdstuk 01' boven een lichte titel en een kort streepje." },
  { key: "nummer", label: "Groot nummer", description: "Groot nummer in de accentkleur naast de titel." },
];

export const PANEL_BLOCKS: { key: PanelBlock; label: string; description: string }[] = [
  { key: "papier", label: "Papier", description: "Zachte papierkleur met een accentlijn links." },
  { key: "tint", label: "Tint", description: "Lichte tint van de hoofdkleur, afgeronde hoeken." },
  { key: "kader", label: "Kader", description: "Wit met een dunne rand. Het meest minimale." },
];

/** The blocks the three original lay-outs stand for. */
export const VARIANT_BLOCKS: Record<LayoutVariant, DesignBlocks> = {
  klassiek: { cover: "kader", opener: "lijn", panel: "papier" },
  modern: { cover: "kleurvlak", opener: "balk", panel: "tint" },
  minimalistisch: { cover: "zijbalk", opener: "hoofdstuk", panel: "kader" },
};

export const isCoverBlock = (v: unknown): v is CoverBlock => COVER_BLOCKS.some((b) => b.key === v);
export const isOpenerBlock = (v: unknown): v is OpenerBlock => OPENER_BLOCKS.some((b) => b.key === v);
export const isPanelBlock = (v: unknown): v is PanelBlock => PANEL_BLOCKS.some((b) => b.key === v);

/** Stored blocks, falling back per block on the lay-out variant. */
export function toDesignBlocks(raw: unknown, variant: LayoutVariant): DesignBlocks {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const base = VARIANT_BLOCKS[variant];
  return {
    cover: isCoverBlock(r.cover) ? r.cover : base.cover,
    opener: isOpenerBlock(r.opener) ? r.opener : base.opener,
    panel: isPanelBlock(r.panel) ? r.panel : base.panel,
  };
}

export interface HouseStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  layoutVariant: LayoutVariant;
  blocks: DesignBlocks;
  /** Path in the private "logos" bucket. */
  logoPath: string | null;
}

export const LAYOUT_VARIANTS: { key: LayoutVariant; label: string; description: string }[] = [
  { key: "klassiek", label: "Klassiek", description: "Rustig en traditioneel, met serif-koppen en fijne lijnen." },
  { key: "modern", label: "Modern", description: "Krachtige kleurvlakken en een opvallende voorpagina." },
  { key: "minimalistisch", label: "Minimalistisch", description: "Veel witruimte, kleur alleen als accent." },
];

export const DEFAULT_HOUSE_STYLE: HouseStyle = {
  primaryColor: "#1F3A5F",
  secondaryColor: "#4A6FA5",
  accentColor: "#C9A227",
  fontHeading: "Merriweather",
  fontBody: "Inter",
  layoutVariant: "klassiek",
  blocks: VARIANT_BLOCKS.klassiek,
  logoPath: null,
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value);
}

export function isLayoutVariant(value: unknown): value is LayoutVariant {
  return value === "klassiek" || value === "modern" || value === "minimalistisch";
}

/** From a house_styles row (or a stored snapshot) to a validated HouseStyle. */
export function toHouseStyle(raw: unknown): HouseStyle {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const pick = (a: string, b: string) => r[a] ?? r[b];
  const primary = pick("primary_color", "primaryColor");
  const secondary = pick("secondary_color", "secondaryColor");
  const accent = pick("accent_color", "accentColor");
  const heading = pick("font_heading", "fontHeading");
  const body = pick("font_body", "fontBody");
  const layout = pick("layout_variant", "layoutVariant");
  const logo = pick("logo_path", "logoPath");
  const blocks = pick("ontwerp", "blocks");
  return {
    primaryColor: isHexColor(primary) ? primary : DEFAULT_HOUSE_STYLE.primaryColor,
    secondaryColor: isHexColor(secondary) ? secondary : DEFAULT_HOUSE_STYLE.secondaryColor,
    accentColor: isHexColor(accent) ? accent : DEFAULT_HOUSE_STYLE.accentColor,
    fontHeading: isFontName(heading) ? heading : DEFAULT_HOUSE_STYLE.fontHeading,
    fontBody: isFontName(body) ? body : DEFAULT_HOUSE_STYLE.fontBody,
    layoutVariant: isLayoutVariant(layout) ? layout : DEFAULT_HOUSE_STYLE.layoutVariant,
    blocks: toDesignBlocks(blocks, isLayoutVariant(layout) ? layout : DEFAULT_HOUSE_STYLE.layoutVariant),
    logoPath: typeof logo === "string" && logo ? logo : null,
  };
}
