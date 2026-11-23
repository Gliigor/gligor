import { PACKAGES, type PackageKey } from "../config";
import { formatDateLong, formatEuro } from "../format";

export interface TemplateClient {
  company: string;
  owner_name: string;
  package: PackageKey;
  monthly_fee: number;
  start_date: string | null;
}

/** Variabelen die in elk sjabloon beschikbaar zijn. */
export const TEMPLATE_VARIABLES = [
  { name: "voornaam", desc: "Voornaam van de eigenaar" },
  { name: "naam", desc: "Volledige naam van de eigenaar" },
  { name: "bedrijf", desc: "Bedrijfsnaam" },
  { name: "pakket", desc: "Basis of Plus" },
  { name: "maandbedrag", desc: "Bijv. € 100" },
  { name: "startdatum", desc: "Startdatum, voluit" },
  { name: "bedrag", desc: "Bedrag (betaalherinnering)" },
  { name: "omschrijving", desc: "Omschrijving (betaalherinnering)" },
  { name: "vervaldatum", desc: "Vervaldatum (betaalherinnering)" },
] as const;

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function clientVariables(c: TemplateClient): Record<string, string> {
  return {
    voornaam: firstName(c.owner_name) || "daar",
    naam: c.owner_name,
    bedrijf: c.company,
    pakket: PACKAGES[c.package].label,
    maandbedrag: formatEuro(c.monthly_fee),
    startdatum: c.start_date ? formatDateLong(c.start_date) : "",
  };
}

/** Vervangt {{variabele}}. Onbekende variabelen blijven zichtbaar staan, zodat ze opvallen. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
    const v = vars[name.toLowerCase()];
    return v === undefined ? whole : v;
  });
}

/** Platte tekst naar eenvoudige, nette HTML voor e-mail. */
export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2933">${paragraphs}</div>`;
}
