/**
 * Genereert de afbeeldingen rond het logo met een headless browser:
 *   public/og-image.png          (1200×630, voor LinkedIn/WhatsApp-previews)
 *   public/apple-touch-icon.png  (180×180)
 *   public/icon-192.png, public/icon-512.png
 *   public/favicon.ico           (32×32, PNG in een ICO-container)
 *   src/assets/gligor.jpg        (alleen als er nog geen foto staat: placeholder)
 *
 *   npm run assets      (vereist Playwright: npm i -D playwright && npx playwright install chromium)
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => path.join(root, "public", p);
const logo = JSON.parse(fs.readFileSync(path.join(root, "src/components/logo-data.json"), "utf8"));
const favicon = fs.readFileSync(pub("favicon.svg"), "utf8");
const fontFile = (f) => "data:font/woff2;base64," + fs.readFileSync(path.join(root, "node_modules/@fontsource-variable/dm-sans/files", f)).toString("base64");

const logoSvg = (fill = "#EDEDED", tld = "#3EE08F") => `
<svg viewBox="${logo.viewBox}" xmlns="http://www.w3.org/2000/svg">
  <path fill="${fill}" d="${logo.word}"/><path fill="${tld}" d="${logo.tld}"/>
</svg>`;

const base = `
<style>
  @font-face { font-family: "DM"; src: url(${fontFile("dm-sans-latin-wght-normal.woff2")}) format("woff2"); font-weight: 100 1000; }
  @font-face { font-family: "DM"; font-style: italic; src: url(${fontFile("dm-sans-latin-wght-italic.woff2")}) format("woff2"); font-weight: 100 1000; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: "DM", sans-serif; }
</style>`;

const og = `${base}
<div style="width:1200px;height:630px;position:relative;overflow:hidden;background:#0A0A0B;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between">
  <div style="position:absolute;right:-200px;top:-260px;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle, rgba(62,224,143,.16), rgba(62,224,143,0) 65%)"></div>
  <div style="height:60px;position:relative">${logoSvg().replace("<svg", '<svg style="height:60px;width:auto"')}</div>
  <div style="position:relative">
    <div style="font-size:74px;line-height:1.06;font-weight:700;letter-spacing:-0.035em;color:#EDEDED;max-width:940px">
      AI voor kleine bedrijven, voor <span style="color:#3EE08F">€100 per maand.</span>
    </div>
    <div style="margin-top:28px;font-size:30px;color:#A1A1AA;font-weight:500">Persoonlijk, zonder jargon. Maandelijks opzegbaar.</div>
  </div>
  <div style="position:relative;display:flex;gap:14px">
    ${["Minder e-mailwerk", "Geen overtypen", "Offertes in minuten"].map((t) => `<span style="font-size:22px;font-weight:600;color:#EDEDED;background:#18181B;border:1px solid #27272A;border-radius:999px;padding:10px 20px">${t}</span>`).join("")}
  </div>
</div>`;

const icon = (size) => `${base}<div style="width:${size}px;height:${size}px">${favicon.replace("<svg", `<svg width="${size}" height="${size}"`)}</div>`;
// Apple maakt zelf ronde hoeken: vul het hele vlak.
const appleIcon = `${base}<div style="width:180px;height:180px;background:#0A0A0B">${favicon.replace('rx="220"', 'rx="0"').replace("<svg", '<svg width="180" height="180"')}</div>`;

const photo = `${base}
<div style="width:920px;height:1150px;position:relative;overflow:hidden;background:linear-gradient(160deg,#F4F5F4 0%,#E3F7EC 100%);display:flex;align-items:flex-end;justify-content:center">
  <div style="position:absolute;left:50%;top:250px;transform:translateX(-50%);width:330px;height:330px;border-radius:50%;background:linear-gradient(160deg,#D4D4D8,#A1A1AA)"></div>
  <div style="width:720px;height:520px;border-radius:360px 360px 0 0;background:linear-gradient(160deg,#27272A,#0A0A0B)"></div>
  <div style="position:absolute;left:0;right:0;bottom:150px;text-align:center;font-size:40px;font-weight:700;color:#fff">Foto van Gligor</div>
  <div style="position:absolute;left:0;right:0;bottom:105px;text-align:center;font-size:24px;color:rgba(255,255,255,.65)">src/assets/gligor.jpg</div>
</div>`;

const browser = await chromium.launch();
const page = await browser.newPage();

async function render(html, w, h, out, opts = {}) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h }, ...opts });
  console.log("✓", path.relative(root, out));
}

await render(og, 1200, 630, pub("og-image.png"));
await render(appleIcon, 180, 180, pub("apple-touch-icon.png"));
await render(icon(192), 192, 192, pub("icon-192.png"), { omitBackground: true });
await render(icon(512), 512, 512, pub("icon-512.png"), { omitBackground: true });
await render(icon(32), 32, 32, pub("favicon-32.png"), { omitBackground: true });

// favicon.ico: één 32×32 PNG verpakt in een ICO-header.
const png = fs.readFileSync(pub("favicon-32.png"));
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync(pub("favicon.ico"), Buffer.concat([header, png]));
fs.unlinkSync(pub("favicon-32.png"));
console.log("✓ public/favicon.ico");

const photoPath = path.join(root, "src/assets/gligor.jpg");
if (!fs.existsSync(photoPath)) {
  fs.mkdirSync(path.dirname(photoPath), { recursive: true });
  await render(photo, 920, 1150, photoPath, { type: "jpeg", quality: 82 });
}

await browser.close();
