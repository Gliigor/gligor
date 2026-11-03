// usage: node stills.mjs <outPrefix> <frame,frame,...> [scale] [comp]  - bundles once, renders JPEG stills (SwiftShader GL)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5", id = "TigerShortClean"] = process.argv.slice(2);
const browserExecutable = "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";
const chromiumOptions = { gl: "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions, inputProps: { audio: null, noPost: !!process.env.NOPOST, ...(process.env.ONLY ? { only: process.env.ONLY } : {}), ...(process.env.MS ? { ms: Number(process.env.MS) } : {}) } });
const onBrowserLog = (l) => { if (!l.text.includes("Clock")) console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${String(f).padStart(4, "0")}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    browserExecutable, chromiumOptions, timeoutInMilliseconds: 240000, onBrowserLog, inputProps: { ...composition.defaultProps, audio: null, noPost: !!process.env.NOPOST, ...(process.env.ONLY ? { only: process.env.ONLY } : {}), ...(process.env.MS ? { ms: Number(process.env.MS) } : {}) } });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
