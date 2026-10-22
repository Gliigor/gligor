// Report designs: a combination of colours, fonts and building blocks.
// The AI designer proposes three; without AI, three example designs are made
// from the current colours. Content, numbers and charts never change.

import { z } from "zod";
import { FONT_NAMES, FONT_OPTIONS } from "./fonts";
import { COVER_BLOCKS, OPENER_BLOCKS, PANEL_BLOCKS, type DesignBlocks, type HouseStyle } from "./types";

export const MAX_WISH_LENGTH = 400;

export interface ReportDesign {
  name: string;
  rationale: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontHeading: string;
  fontBody: string;
  blocks: DesignBlocks;
}

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Six-digit hex colour, e.g. #1F3A5F.");
const font = z.enum(FONT_NAMES as [string, ...string[]]);
const cover = z.enum(COVER_BLOCKS.map((b) => b.key) as [string, ...string[]]);
const opener = z.enum(OPENER_BLOCKS.map((b) => b.key) as [string, ...string[]]);
const panel = z.enum(PANEL_BLOCKS.map((b) => b.key) as [string, ...string[]]);

/** What the AI designer must return. */
export const designProposalSchema = z.object({
  designs: z
    .array(
      z.object({
        name: z.string().describe("Short Dutch name for the design, 1 to 3 words, e.g. 'Rustig goud'."),
        rationale: z.string().describe("One Dutch sentence (max. 25 words) on why this fits the firm."),
        primaryColor: hex.describe("Main colour: cover, headings, main chart line. Dark enough for white text on it."),
        secondaryColor: hex.describe("Second chart colour, related to the primary."),
        accentColor: hex.describe("Accent for lines, numbers and details; must stand out against the primary."),
        fontHeading: font.describe("Font for headings."),
        fontBody: font.describe("Font for running text; prefer a sans-serif for readability."),
        cover: cover.describe("Cover block."),
        opener: opener.describe("Chapter heading block."),
        panel: panel.describe("Panel block for key figures and remarks."),
      }),
    )
    .describe("Exactly three clearly different designs."),
});

export type DesignProposal = z.infer<typeof designProposalSchema>;

const toDesign = (d: DesignProposal["designs"][number]): ReportDesign => ({
  name: d.name.trim().slice(0, 40) || "Ontwerp",
  rationale: d.rationale.trim().slice(0, 240),
  primaryColor: d.primaryColor.toUpperCase(),
  secondaryColor: d.secondaryColor.toUpperCase(),
  accentColor: d.accentColor.toUpperCase(),
  fontHeading: d.fontHeading,
  fontBody: d.fontBody,
  blocks: { cover: d.cover, opener: d.opener, panel: d.panel } as DesignBlocks,
});

/** Validated designs from the model's answer (at most three), or null. */
export function parseDesignProposal(raw: unknown): ReportDesign[] | null {
  const parsed = designProposalSchema.safeParse(raw);
  if (!parsed.success || parsed.data.designs.length === 0) return null;
  return parsed.data.designs.slice(0, 3).map(toDesign);
}

/** Text for the model: every building block and font it may choose from. */
export function catalogue(): string {
  const list = (title: string, items: { key: string; description: string }[]) =>
    `${title}:\n${items.map((i) => `- ${i.key}: ${i.description}`).join("\n")}`;
  return [
    list("Cover blocks (cover)", COVER_BLOCKS),
    list("Chapter heading blocks (opener)", OPENER_BLOCKS),
    list("Panel blocks (panel)", PANEL_BLOCKS),
    `Fonts: ${FONT_OPTIONS.map((f) => `${f.name} (${f.category === "serif" ? "serif" : "sans-serif"})`).join(", ")}`,
  ].join("\n\n");
}

function shift(hexColor: string, amount: number): string {
  const n = parseInt(hexColor.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()}`;
}

/** Three example designs from the current colours, used when the AI designer is off. */
export function exampleDesigns(base: Pick<HouseStyle, "primaryColor" | "secondaryColor" | "accentColor">): ReportDesign[] {
  return [
    {
      name: "Klassiek",
      rationale: "Volledig gekleurde voorpagina met een lijst en schreefletters: formeel en vertrouwd.",
      primaryColor: base.primaryColor,
      secondaryColor: base.secondaryColor,
      accentColor: base.accentColor,
      fontHeading: "Libre Baskerville",
      fontBody: "Source Sans 3",
      blocks: { cover: "kader", opener: "lijn", panel: "papier" },
    },
    {
      name: "Licht",
      rationale: "Veel wit, de hoofdkleur alleen als accent en grote hoofdstuknummers: luchtig en verfijnd.",
      primaryColor: shift(base.primaryColor, -0.15),
      secondaryColor: base.secondaryColor,
      accentColor: base.accentColor,
      fontHeading: "Playfair Display",
      fontBody: "Lato",
      blocks: { cover: "licht", opener: "nummer", panel: "kader" },
    },
    {
      name: "Modern",
      rationale: "Groot kleurvlak en gekleurde hoofdstukbalken met een schreefloze letter: uitgesproken en eigentijds.",
      primaryColor: base.primaryColor,
      secondaryColor: shift(base.secondaryColor, 0.15),
      accentColor: base.accentColor,
      fontHeading: "Montserrat",
      fontBody: "Inter",
      blocks: { cover: "kleurvlak", opener: "balk", panel: "tint" },
    },
  ];
}
