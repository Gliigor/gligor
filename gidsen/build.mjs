/**
 * Maakt van de Markdown-gidsen in content/ nette PDF's in pdf/, in de huisstijl
 * van gligor.ai (DM Sans, groen, cursief woordmerk).
 *
 *   npm install && npm run build
 *
 * Vereist Playwright met Chromium (npm i -D playwright && npx playwright install chromium).
 * Alles na <!-- spiekbriefje --> wordt een losse pagina voor de klant.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.dirname(fileURLToPath(import.meta.url));
const site = path.join(root, "..", "gligor-ai");
const outDir = path.join(root, "pdf");
fs.mkdirSync(outDir, { recursive: true });

const font = (f) =>
  "data:font/woff2;base64," +
  fs.readFileSync(path.join(site, "node_modules/@fontsource-variable/dm-sans/files", f)).toString("base64");
const logo = fs.readFileSync(path.join(site, "public/logo.svg"), "utf8").replace("<svg", '<svg class="logo"');

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const marked = new Marked({
  gfm: true,
  renderer: {
    // ```prompt-blokken worden kaartjes om te kopiëren; {velden} krijgen een kleur.
    code({ text, lang }) {
      const body = esc(text).replace(/\{([^}]+)\}/g, '<span class="field">{$1}</span>');
      if (lang === "prompt") return `<div class="prompt"><pre>${body}</pre></div>`;
      return `<pre class="code">${body}</pre>`;
    },
  },
});

function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) {
    const [k, ...v] = line.split(":");
    meta[k.trim()] = v.join(":").trim().replace(/^"|"$/g, "");
  }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

const css = `
@font-face { font-family: "DM"; src: url(${font("dm-sans-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 1000; }
@font-face { font-family: "DM"; font-style: italic; src: url(${font("dm-sans-latin-wght-italic.woff2")}) format("woff2"); font-weight: 100 1000; }
@page { size: A4; margin: 18mm 17mm 20mm; }
:root { --fg: #0a0a0b; --ink: #3a3d40; --muted: #6b6f73; --line: #e6e8e7; --mist: #f6f7f6; --accent: #0e8f50; --brand: #3ee08f; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "DM", system-ui, sans-serif; font-size: 10.2pt; line-height: 1.55; color: var(--ink); }
.logo { height: 22px; width: auto; display: block; }
.cover { border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px; }
.cover .kicker { margin-top: 22px; font-size: 8.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--accent); }
.cover h1 { margin: 4px 0 6px; font-size: 26pt; line-height: 1.1; letter-spacing: -0.03em; color: var(--fg); }
.cover .sub { margin: 0; font-size: 12pt; color: var(--muted); max-width: 150mm; }
h2 { margin: 22px 0 8px; font-size: 14pt; letter-spacing: -0.02em; color: var(--fg); break-after: avoid; }
h3 { margin: 14px 0 5px; font-size: 11pt; color: var(--fg); break-after: avoid; }
p { margin: 0 0 8px; }
strong { color: var(--fg); }
ul, ol { margin: 0 0 10px; padding-left: 18px; }
li { margin: 2px 0; }
li:has(> input[type=checkbox]) { list-style: none; margin-left: -18px; }
input[type=checkbox] { appearance: none; width: 10px; height: 10px; border: 1.3px solid var(--accent); border-radius: 2px; margin: 0 7px 0 0; vertical-align: -1px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.3pt; break-inside: avoid; }
th { text-align: left; font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); font-weight: 700; border-bottom: 1.5px solid var(--fg); padding: 5px 8px 5px 0; }
td { border-bottom: 1px solid var(--line); padding: 5px 8px 5px 0; vertical-align: top; }
td:first-child { color: var(--fg); }
.prompt { margin: 6px 0 12px; border: 1px solid var(--line); border-left: 3px solid var(--brand); border-radius: 6px; background: var(--mist); padding: 8px 11px; break-inside: avoid; }
.prompt pre, pre.code { margin: 0; white-space: pre-wrap; font-family: "DM", monospace; font-size: 9.2pt; line-height: 1.5; color: var(--fg); }
.field { color: var(--accent); font-weight: 600; }
blockquote { margin: 8px 0 12px; padding: 10px 14px; background: var(--mist); border-radius: 6px; font-style: italic; color: var(--fg); break-inside: avoid; }
blockquote p { margin: 0; }
.tip { margin: 10px 0 14px; padding: 9px 12px; border-radius: 6px; background: #e9f9f0; border: 1px solid #bdecd3; color: #14532d; font-size: 9.6pt; break-inside: avoid; }
.tip strong { color: #0b4d2a; }
/* Spiekbriefje: een losse pagina voor de klant */
.cheat { break-before: page; }
.cheat-band { display: flex; align-items: center; justify-content: space-between; background: #0a0a0b; color: #ededed; border-radius: 10px; padding: 12px 16px; margin-bottom: 14px; }
.cheat-band .label { font-size: 8.5pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--brand); }
.cheat-band .logo path:first-child { fill: #ededed; }
.cheat-band .logo path:last-child { fill: #3ee08f; }
.cheat h1 { margin: 0 0 6px; font-size: 20pt; letter-spacing: -0.03em; color: var(--fg); }
.cheat h3 { margin: 10px 0 3px; }
.cheat .prompt { margin: 3px 0 6px; padding: 6px 10px; }
.rules { margin-top: 12px; padding: 10px 14px; border: 1.5px solid var(--fg); border-radius: 8px; break-inside: avoid; }
.rules p:first-child { margin-bottom: 4px; }
.rules ul { margin: 0; }
.shortcuts table { font-size: 10pt; }
.shortcuts td:first-child { font-weight: 700; color: var(--accent); width: 32mm; }
`;

const files = fs.readdirSync(path.join(root, "content")).filter((f) => f.endsWith(".md")).sort();
const browser = await chromium.launch();
const page = await browser.newPage();

for (const file of files) {
  const { meta, body } = frontMatter(fs.readFileSync(path.join(root, "content", file), "utf8"));
  const [guide, cheat] = body.split("<!-- spiekbriefje -->");
  const html = `<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>${css}</style></head><body>
    <header class="cover">
      ${logo}
      <div class="kicker">Implementatiegids ${meta.nummer}</div>
      <h1>${meta.titel}</h1>
      <p class="sub">${meta.ondertitel ?? ""}</p>
    </header>
    <main>${marked.parse(guide)}</main>
    ${cheat ? `<section class="cheat"><div class="cheat-band">${logo}<span class="label">Spiekbriefje</span></div>${marked.parse(cheat)}</section>` : ""}
  </body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  const name = file.replace(/\.md$/, "");
  const footer = `<div style="width:100%;font-family:sans-serif;font-size:7.5pt;color:#8b8b93;padding:0 17mm;display:flex;justify-content:space-between">
      <span>gligor.ai · Implementatiegids ${meta.nummer} · ${esc(meta.titel)}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`;
  await page.pdf({
    path: path.join(outDir, `${name}.pdf`),
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: footer,
    margin: { top: "18mm", bottom: "20mm", left: "17mm", right: "17mm" },
  });
  // Los spiekbriefje (alleen de klantpagina), om te printen of door te sturen.
  if (cheat) {
    await page.setContent(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><style>${css} .cheat{break-before:auto}</style></head><body>
      <section class="cheat"><div class="cheat-band">${logo}<span class="label">Spiekbriefje</span></div>${marked.parse(cheat)}</section></body></html>`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({
      path: path.join(outDir, `${name}-spiekbriefje.pdf`),
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "17mm", right: "17mm" },
    });
  }
  console.log("✓", name);
}
await browser.close();
