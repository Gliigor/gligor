/**
 * Builds the gligor.ai wordmark as plain SVG paths from Plus Jakarta Sans
 * (ExtraBold), so the logo looks identical everywhere, with or without the
 * web font. The dot of the first "i" is replaced by a blue-to-teal spark.
 *
 *   node scripts/build-logo.mjs
 *
 * Writes src/components/logo-data.json (used by Logo.astro) and
 * public/logo.svg (standalone file for e-mail signatures, documents, etc.).
 */
import * as fontkit from "fontkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontFile = path.join(
  root,
  "node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
);
const font = fontkit.openSync(fontFile).getVariation({ wght: 800 });

const TEXT = "gligor.ai";
const SPLIT = 6; // "gligor" | ".ai"
const TRACKING = -28; // font units, "slightly tight letter spacing"
const SPARK_INDEX = 2; // first "i"

const run = font.layout(TEXT);
let x = 0;
const pieces = [];
let spark = null;

run.glyphs.forEach((glyph, idx) => {
  const pos = run.positions[idx];
  let commands = glyph.path.commands;

  if (idx === SPARK_INDEX) {
    // Split into contours and keep the stem (the contour that touches the baseline).
    const contours = [];
    for (const c of commands) {
      if (c.command === "moveTo") contours.push([]);
      contours[contours.length - 1].push(c);
    }
    const minY = (cs) => Math.min(...cs.flatMap((c) => c.args.filter((_, i) => i % 2 === 1)));
    const maxY = (cs) => Math.max(...cs.flatMap((c) => c.args.filter((_, i) => i % 2 === 1)));
    const stem = contours.reduce((a, b) => (minY(a) <= minY(b) ? a : b));
    const dot = contours.find((c) => c !== stem);
    commands = stem;
    const bb = glyph.bbox;
    const dotCenterY = dot ? (minY(dot) + maxY(dot)) / 2 : bb.maxY - 60;
    spark = { cx: x + pos.xOffset + (bb.minX + bb.maxX) / 2, cy: dotCenterY };
  }

  const d = commands
    .map((c) => {
      const a = c.args.map((v, i) => (i % 2 === 0 ? v + x + pos.xOffset : -(v + pos.yOffset)));
      const r = a.map((v) => Math.round(v * 10) / 10);
      switch (c.command) {
        case "moveTo": return `M${r.join(" ")}`;
        case "lineTo": return `L${r.join(" ")}`;
        case "quadraticCurveTo": return `Q${r.join(" ")}`;
        case "bezierCurveTo": return `C${r.join(" ")}`;
        case "closePath": return "Z";
        default: return "";
      }
    })
    .join("");

  pieces.push({ d, part: idx < SPLIT ? "word" : "tld" });
  const isLast = idx === run.glyphs.length - 1;
  // Pull the "." in a little so "gligor.ai" reads as one word.
  const extra = idx === SPLIT - 1 || idx === SPLIT ? -40 : 0;
  x += pos.xAdvance + (isLast ? 0 : TRACKING + extra);
});

// Four-pointed spark, a little bigger than the dot it replaces.
const R = 128;
const r = 52;
const { cx } = spark;
const cy = -spark.cy - 14;
const sparkPath = [
  `M${cx} ${cy - R}`,
  `C${cx + r * 0.35} ${cy - r} ${cx + r} ${cy - r * 0.35} ${cx + R} ${cy}`,
  `C${cx + r} ${cy + r * 0.35} ${cx + r * 0.35} ${cy + r} ${cx} ${cy + R}`,
  `C${cx - r * 0.35} ${cy + r} ${cx - r} ${cy + r * 0.35} ${cx - R} ${cy}`,
  `C${cx - r} ${cy - r * 0.35} ${cx - r * 0.35} ${cy - r} ${cx} ${cy - R}Z`,
]
  .join("")
  .replace(/\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));

const join = (part) => pieces.filter((p) => p.part === part).map((p) => p.d).join("");
const top = Math.min(-font.ascent * 0.8, cy - R) - 20;
const bottom = -font.descent + 10;
const viewBox = `-10 ${Math.round(top)} ${Math.round(x + 20)} ${Math.round(bottom - top)}`;

const data = { viewBox, word: join("word"), tld: join("tld"), spark: sparkPath, spark_center: [cx, cy], spark_radius: R };
fs.writeFileSync(path.join(root, "src/components/logo-data.json"), JSON.stringify(data, null, 2) + "\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="gligor.ai">
  <defs><linearGradient id="spark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563EB"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>
  <path fill="#0F2A4A" d="${data.word}"/>
  <path fill="#2563EB" d="${data.tld}"/>
  <path fill="url(#spark)" d="${data.spark}"/>
</svg>
`;
fs.writeFileSync(path.join(root, "public/logo.svg"), svg);
console.log("logo written, viewBox", viewBox);

// ---------- Favicon: witte "g" met spark op een navy vlak ----------
{
  const g = font.layout("g").glyphs[0];
  const bb = g.bbox; // font units, y omhoog
  const gw = bb.maxX - bb.minX;
  const gh = bb.maxY - bb.minY;
  const size = 1000;
  const scale = 640 / Math.max(gw, gh);
  const ox = (size - gw * scale) / 2 - bb.minX * scale - 60;
  const oy = (size + gh * scale) / 2 + bb.minY * scale + 20;
  const gPath = g.path.commands
    .map((c) => {
      const a = c.args.map((v, i) => Math.round((i % 2 === 0 ? ox + v * scale : oy - v * scale) * 10) / 10);
      return { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" }[c.command] + a.join(" ");
    })
    .join("");
  const sx = 800, sy = 215, SR = 150, sr = 58;
  const fSpark = `M${sx} ${sy - SR}C${sx + sr * 0.35} ${sy - sr} ${sx + sr} ${sy - sr * 0.35} ${sx + SR} ${sy}C${sx + sr} ${sy + sr * 0.35} ${sx + sr * 0.35} ${sy + sr} ${sx} ${sy + SR}C${sx - sr * 0.35} ${sy + sr} ${sx - sr} ${sy + sr * 0.35} ${sx - SR} ${sy}C${sx - sr} ${sy - sr * 0.35} ${sx - sr * 0.35} ${sy - sr} ${sx} ${sy - SR}Z`.replace(/\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3B82F6"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>
  <rect width="1000" height="1000" rx="220" fill="#0F2A4A"/>
  <path fill="#FFFFFF" d="${gPath}"/>
  <path fill="url(#s)" d="${fSpark}"/>
</svg>
`;
  fs.writeFileSync(path.join(root, "public/favicon.svg"), favicon);
  console.log("favicon written");
}
