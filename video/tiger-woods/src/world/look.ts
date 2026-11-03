// Palette, shared materials and Canvas2D textures (painted procedurally, seeded, so every frame/tab is identical).
import * as THREE from "three";
import { rng } from "../lib/anim";

export const PAL = {
  // base: dark green, sand, off-white; red is reserved for Tiger
  deep: "#2c4a2f",
  rough: "#4f7a3c",
  roughDark: "#436c35",
  fairway: "#6f9b48",
  fairwayAlt: "#79a650",
  green: "#86b55a",
  tee: "#7eab52",
  sand: "#e6d3a3",
  sandShade: "#cdb683",
  offWhite: "#f3eee2",
  paper: "#fbf8f0",
  ink: "#1f2b22",
  red: "#c4202c",
  redDeep: "#9e1622",
  slate: "#71808a",
  soil1: "#8b6b4a",
  soil2: "#735639",
  soil3: "#5d4530",
  rock: "#a99f90",
  sea: "#3f8193",
  seaDeep: "#2c6576",
  foam: "#eef3ee",
  skyTop: "#9fc0d4",
  horizon: "#ece6d6",
  board: "#24452f",
  gold: "#d9b25a",
  silver: "#d8dadb",
};

const cache = new Map<string, THREE.Material>();
export const mat = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) => {
  const key = color + JSON.stringify(Object.keys(opts).length ? opts : "");
  if (!opts.map && cache.has(key)) return cache.get(key)! as THREE.MeshStandardMaterial;
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...opts });
  if (!opts.map) cache.set(key, m);
  return m;
};

export const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
};
export const tex = (c: HTMLCanvasElement, repeat?: [number, number]) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  t.needsUpdate = true;
  return t;
};

/** speckled grass: subtle value noise so large areas never read as flat plastic */
export const grassTex = (base: string, seed: number, stripes = 0) => {
  const [c, g] = canvas(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  if (stripes) {
    for (let i = 0; i < stripes; i++) {
      g.fillStyle = i % 2 ? "rgba(255,255,230,0.075)" : "rgba(0,30,0,0.05)";
      g.fillRect((i * 512) / stripes, 0, 512 / stripes, 512);
    }
  }
  const r = rng(seed);
  for (let i = 0; i < 9000; i++) {
    const x = r() * 512, y = r() * 512, s = 1 + r() * 2.2;
    g.fillStyle = r() > 0.5 ? `rgba(255,255,220,${0.03 + r() * 0.05})` : `rgba(10,40,10,${0.04 + r() * 0.06})`;
    g.fillRect(x, y, s, s);
  }
  return tex(c, [1, 1]);
};

export const sandTex = () => {
  const [c, g] = canvas(256, 256);
  g.fillStyle = PAL.sand; g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  for (let i = 0; i < 6000; i++) {
    g.fillStyle = r() > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(120,90,40,0.10)";
    g.fillRect(r() * 256, r() * 256, 1.4, 1.4);
  }
  return tex(c, [3, 3]);
};

/** layered soil for the cut sides of the diorama */
export const soilTex = () => {
  const [c, g] = canvas(64, 512);
  const bands: [number, string][] = [[0, "#3f6b33"], [0.05, PAL.soil1], [0.32, PAL.soil2], [0.62, PAL.soil3], [1, PAL.soil3]];
  for (let i = 0; i < bands.length - 1; i++) { g.fillStyle = bands[i][1]; g.fillRect(0, bands[i][0] * 512, 64, (bands[i + 1][0] - bands[i][0]) * 512 + 1); }
  const r = rng(5);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(30,20,10,${0.08 + r() * 0.12})`; g.beginPath(); g.arc(r() * 64, 30 + r() * 480, 1 + r() * 3, 0, 7); g.fill(); }
  return tex(c);
};

export const seaTex = () => {
  const [c, g] = canvas(512, 512);
  g.fillStyle = PAL.sea; g.fillRect(0, 0, 512, 512);
  const r = rng(9);
  for (let i = 0; i < 260; i++) {
    const x = r() * 512, y = r() * 512, w = 12 + r() * 40;
    g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.08})`; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - 3, x + w, y); g.stroke();
  }
  return tex(c, [24, 24]);
};

/** soft round contact shadow */
let blobTex: THREE.Texture | null = null;
export const blob = () => {
  if (blobTex) return blobTex;
  const [c, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(0,0,0,0.55)"); gr.addColorStop(0.5, "rgba(0,0,0,0.28)"); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  blobTex = tex(c);
  return blobTex;
};
export const blobMesh = (size: number, opacity = 0.6) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: blob(), transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
};

// ---------------- typography on textures ----------------
export const FONT_TITLE = "'Barlow Condensed'";
export const FONT_UI = "'Inter'";

export const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};

/** fit text into a width by shrinking the font size */
export const fitText = (g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, weight: number, family: string, align: CanvasTextAlign = "center", spacing = 0) => {
  let s = size;
  for (;;) {
    g.font = `${weight} ${s}px ${family}`;
    (g as unknown as { letterSpacing: string }).letterSpacing = `${spacing * s}px`;
    if (g.measureText(text).width <= maxW || s < 8) break;
    s -= 2;
  }
  g.textAlign = align; g.textBaseline = "middle";
  g.fillText(text, x, y);
  return s;
};

export const textMat = (c: HTMLCanvasElement, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.75, metalness: 0, ...opts });
