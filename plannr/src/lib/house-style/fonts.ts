// Curated fonts for reports. No free-text font field: every option here is
// embedded in the PDF (files in assets/fonts) and renders reliably.

export interface FontOption {
  name: string;
  file: string;
  category: "sans" | "serif";
}

export const FONT_OPTIONS: FontOption[] = [
  { name: "Inter", file: "inter", category: "sans" },
  { name: "Source Sans 3", file: "source-sans-3", category: "sans" },
  { name: "IBM Plex Sans", file: "ibm-plex-sans", category: "sans" },
  { name: "Lato", file: "lato", category: "sans" },
  { name: "Montserrat", file: "montserrat", category: "sans" },
  { name: "Roboto", file: "roboto", category: "sans" },
  { name: "Merriweather", file: "merriweather", category: "serif" },
  { name: "Playfair Display", file: "playfair-display", category: "serif" },
  { name: "Libre Baskerville", file: "libre-baskerville", category: "serif" },
  { name: "EB Garamond", file: "eb-garamond", category: "serif" },
];

export const FONT_NAMES = FONT_OPTIONS.map((f) => f.name);

export function isFontName(value: unknown): value is string {
  return typeof value === "string" && FONT_NAMES.includes(value);
}
