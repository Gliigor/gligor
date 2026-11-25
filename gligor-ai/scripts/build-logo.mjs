/**
 * Builds the gligor.ai wordmark as plain SVG paths from DM Sans Italic (Bold),
 * so the logo looks identical everywhere, with or without the web font:
 * "gligor" in the text color, ".ai" in green, the whole word in italics
 * (the same wordmark as admin.gligor.ai).
 *
 *   node scripts/build-logo.mjs
 *
 * Writes src/components/logo-data.json (used by Logo.astro), public/logo.svg
 * (standalone file for e-mail signatures, documents, etc.) and public/favicon.svg.
 */
import * as fontkit from "fontkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontFile = path.join(root, "node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2");
const font = fontkit.openSync(fontFile).getVariation({ wght: 700 });

export const COLORS = { ink: "#0A0A0B", green: "#3EE08F", greenOnLight: "#12A35F" };

const TEXT = "gligor.ai";
const SPLIT = 6; // "gligor" | ".ai"
const TRACKING = -24; // font units: slightly tight, like the dashboard (-0.03em)

const toPath = (commands, dx, dy = 0, scale = 1, flip = true) =>
  commands
    .map((c) => {
      const a = c.args.map((v, i) => {
        const n = i % 2 === 0 ? dx + v * scale : flip ? dy - v * scale : dy + v * scale;
        return Math.round(n * 10) / 10;
      });
      return { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" }[c.command] + a.join(" ");
    })
    .join("");

const run = font.layout(TEXT);
let x = 0;
const pieces = [];
run.glyphs.forEach((glyph, idx) => {
  const pos = run.positions[idx];
  pieces.push({ d: toPath(glyph.path.commands, x + pos.xOffset, -pos.yOffset), part: idx < SPLIT ? "word" : "tld" });
  if (idx < run.glyphs.length - 1) x += pos.xAdvance + TRACKING;
  else x += pos.xAdvance;
});

const join = (part) => pieces.filter((p) => p.part === part).map((p) => p.d).join("");
const top = -font.ascent * 0.82;
const bottom = -font.descent + 20;
const viewBox = `-20 ${Math.round(top)} ${Math.round(x + 60)} ${Math.round(bottom - top)}`;

const data = { viewBox, word: join("word"), tld: join("tld") };
fs.writeFileSync(path.join(root, "src/components/logo-data.json"), JSON.stringify(data, null, 2) + "\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="gligor.ai">
  <path fill="${COLORS.ink}" d="${data.word}"/>
  <path fill="${COLORS.greenOnLight}" d="${data.tld}"/>
</svg>
`;
fs.writeFileSync(path.join(root, "public/logo.svg"), svg);
console.log("logo written, viewBox", viewBox);

// ---------- Favicon: witte cursieve "g" met een groene punt, op een bijna-zwart vlak ----------
{
  const g = font.layout("g").glyphs[0];
  const bb = g.bbox;
  const gw = bb.maxX - bb.minX;
  const gh = bb.maxY - bb.minY;
  const scale = 620 / Math.max(gw, gh);
  const ox = 470 - (bb.minX + gw / 2) * scale;
  const oy = 500 + (bb.minY + gh / 2) * scale;
  const gPath = toPath(g.path.commands, ox, oy, scale);
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <rect width="1000" height="1000" rx="220" fill="${COLORS.ink}"/>
  <path fill="#FFFFFF" d="${gPath}"/>
  <circle cx="790" cy="730" r="78" fill="${COLORS.green}"/>
</svg>
`;
  fs.writeFileSync(path.join(root, "public/favicon.svg"), favicon);
  console.log("favicon written");
}
