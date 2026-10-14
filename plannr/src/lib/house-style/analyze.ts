// Pure functions that turn a website's HTML/CSS into a house-style suggestion.
// Kept free of network code so they can be unit-tested.

import { FONT_OPTIONS } from "./fonts";
import { DEFAULT_HOUSE_STYLE } from "./types";

export interface StyleSuggestion {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  /** What was found, in Dutch, for the owner. */
  notes: string[];
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

function hsl({ r, g, b }: Rgb) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function normalizeHex(raw: string): string | null {
  const m = raw.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const v = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${v.toUpperCase()}`;
}

/** Brand-like colors: saturated enough, not near-white or near-black. */
function isBrandColor(hex: string): boolean {
  const { s, l } = hsl(hexToRgb(hex));
  return s >= 0.25 && l >= 0.12 && l <= 0.82;
}

export function extractColors(css: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (hex: string | null) => {
    if (hex && isBrandColor(hex)) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  };
  for (const m of css.matchAll(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) add(normalizeHex(m[0]));
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/g)) {
    add(rgbToHex({ r: Math.min(255, +m[1]), g: Math.min(255, +m[2]), b: Math.min(255, +m[3]) }));
  }
  return counts;
}

function themeColor(html: string): string | null {
  const m =
    html.match(/<meta[^>]+name=["']theme-color["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']theme-color["']/i);
  return m ? normalizeHex(m[1]) : null;
}

const SERIF_HINTS = ["serif", "georgia", "times", "garamond", "baskerville", "playfair", "merriweather", "caslon", "didot", "bodoni", "lora", "crimson"];

export function extractFonts(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s)>]+)/g)) {
    for (const fam of m[1].matchAll(/family=([^&:]+)/g)) found.push(decodeURIComponent(fam[1].replace(/\+/g, " ")));
  }
  for (const m of text.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (first && !first.startsWith("var(") && !/^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|-apple-system)$/i.test(first)) {
      found.push(first);
    }
  }
  return [...new Set(found)];
}

function closestFont(detected: string[], want: "sans" | "serif" | "any"): string | null {
  for (const name of detected) {
    const exact = FONT_OPTIONS.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (exact && (want === "any" || exact.category === want)) return exact.name;
  }
  for (const name of detected) {
    const isSerif = SERIF_HINTS.some((h) => name.toLowerCase().includes(h)) && !name.toLowerCase().includes("sans");
    if (want === "serif" && isSerif) return name.toLowerCase().includes("garamond") ? "EB Garamond" : "Merriweather";
    if (want === "sans" && !isSerif) return "Inter";
  }
  return null;
}

export function suggestFromSources(html: string, stylesheets: string[]): StyleSuggestion {
  const notes: string[] = [];
  const allCss = [html, ...stylesheets].join("\n");
  const counts = extractColors(allCss);
  const theme = themeColor(html);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([hex]) => hex);

  const picked: string[] = [];
  const pickDistinct = (candidates: string[]) => {
    for (const c of candidates) {
      if (picked.every((p) => distance(hexToRgb(p), hexToRgb(c)) > 60)) {
        picked.push(c);
        return c;
      }
    }
    return null;
  };

  const primary =
    (theme && isBrandColor(theme) ? pickDistinct([theme]) : null) ??
    pickDistinct(ranked.filter((c) => hsl(hexToRgb(c)).l < 0.55)) ??
    pickDistinct(ranked);
  const secondary = pickDistinct(ranked);
  const accent = pickDistinct([...ranked].sort((a, b) => hsl(hexToRgb(b)).s - hsl(hexToRgb(a)).s));

  if (primary) notes.push(theme === primary ? "Hoofdkleur gevonden via de theme-color van de website." : "Kleuren afgeleid uit de stijlen van de website.");
  else notes.push("Geen duidelijke merkkleuren gevonden; standaardkleuren voorgesteld.");

  const fonts = extractFonts(allCss);
  const heading = closestFont(fonts, "serif") ?? closestFont(fonts, "any");
  const body = closestFont(fonts, "sans");
  if (fonts.length > 0) notes.push(`Lettertypen op de website: ${fonts.slice(0, 4).join(", ")}.`);
  else notes.push("Geen lettertypen gevonden; standaardlettertypen voorgesteld.");

  return {
    primaryColor: primary ?? DEFAULT_HOUSE_STYLE.primaryColor,
    secondaryColor: secondary ?? DEFAULT_HOUSE_STYLE.secondaryColor,
    accentColor: accent ?? DEFAULT_HOUSE_STYLE.accentColor,
    fontHeading: heading ?? body ?? DEFAULT_HOUSE_STYLE.fontHeading,
    fontBody: body ?? DEFAULT_HOUSE_STYLE.fontBody,
    notes,
  };
}
