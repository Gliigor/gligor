import type { LayoutVariant } from "@/lib/plan/types";
import { isFontName } from "./fonts";

export interface HouseStyle {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  layoutVariant: LayoutVariant;
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
  return {
    primaryColor: isHexColor(primary) ? primary : DEFAULT_HOUSE_STYLE.primaryColor,
    secondaryColor: isHexColor(secondary) ? secondary : DEFAULT_HOUSE_STYLE.secondaryColor,
    accentColor: isHexColor(accent) ? accent : DEFAULT_HOUSE_STYLE.accentColor,
    fontHeading: isFontName(heading) ? heading : DEFAULT_HOUSE_STYLE.fontHeading,
    fontBody: isFontName(body) ? body : DEFAULT_HOUSE_STYLE.fontBody,
    layoutVariant: isLayoutVariant(layout) ? layout : DEFAULT_HOUSE_STYLE.layoutVariant,
    logoPath: typeof logo === "string" && logo ? logo : null,
  };
}
