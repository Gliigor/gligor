// Scoreboard, score-scale tiles (which double as the nine win tiles), placards, trophies, podium, ball + trail.
import * as THREE from "three";
import { PAL, mat, canvas, tex, fitText, roundRect, FONT_TITLE, FONT_UI } from "./look";

const MINUS = "−";
export const fmt = (v: number) => (v === 0 ? "0" : v < 0 ? `${MINUS}${-v}` : `+${v}`);

// ---------------- scoreboard ----------------
type Flip = { g: THREE.Group; t: number };
export class Scoreboard {
  root = new THREE.Group();
  flips: Record<string, THREE.Group> = {};
  tag = new THREE.Group();
  constructor() {
    const R = new THREE.Group();
    this.root.add(R);
    const wood = mat("#ece6d6"), green = mat(PAL.board), dark = mat("#1b3324");
    for (const x of [-1.62, 1.62]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3, 0.16), wood);
      post.position.set(x, 1.15, -0.05); post.castShadow = true; R.add(post);
    }
    const W = 3.6, H = 4.4, Y0 = 2.0;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, H + 0.2, 0.18), wood);
    frame.position.set(0, Y0 + H / 2, -0.1); frame.castShadow = true; frame.receiveShadow = true; R.add(frame);
    const face = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.05), green);
    face.position.set(0, Y0 + H / 2, 0.0); face.receiveShadow = true; R.add(face);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.12, 0.7), dark);
    roof.position.set(0, Y0 + H + 0.16, 0.12); roof.rotation.x = 0.12; roof.castShadow = true; R.add(roof);

    // header (always visible)
    const [hc, hg] = canvas(1200, 400);
    hg.fillStyle = PAL.board; hg.fillRect(0, 0, 1200, 400);
    hg.fillStyle = PAL.offWhite;
    fitText(hg, `U.S. OPEN · 2000`, 600, 165, 1080, 190, 800, FONT_TITLE, "center", 0.04);
    hg.fillStyle = "rgba(243,238,226,0.7)";
    fitText(hg, "PEBBLE BEACH", 600, 318, 1000, 64, 600, FONT_UI, "center", 0.32);
    const header = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, (W - 0.2) / 3), new THREE.MeshStandardMaterial({ map: tex(hc), roughness: 0.8 }));
    header.position.set(0, Y0 + H - 0.72, 0.03); R.add(header);
    // column captions
    const [cc, cg] = canvas(1200, 90);
    cg.fillStyle = PAL.board; cg.fillRect(0, 0, 1200, 90);
    cg.fillStyle = "rgba(243,238,226,0.75)";
    fitText(cg, "SPELER", 40, 45, 600, 54, 600, FONT_UI, "left", 0.2);
    fitText(cg, "SCORE", 1160, 45, 400, 54, 600, FONT_UI, "right", 0.2);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, (W - 0.2) * 0.075), new THREE.MeshStandardMaterial({ map: tex(cc), roughness: 0.8 }));
    cap.position.set(0, Y0 + H - 1.43, 0.03); R.add(cap);

    const rows: [string, string, string, number, boolean][] = [
      ["1", "TIGER WOODS", fmt(-12), 0, true],
      ["T2", "ERNIE ELS", fmt(3), 1, false],
      ["T2", "MIGUEL ÁNGEL JIMÉNEZ", fmt(3), 2, false],
    ];
    const rowH = 0.66, nameW = 2.42, scoreW = 0.94, gap = 0.04;
    for (const [pos, name, score, i, tiger] of rows) {
      const y = Y0 + H - 2.0 - i * (rowH + 0.1);
      // name panel
      const [nc, ng] = canvas(1210, 330);
      ng.fillStyle = PAL.paper; roundRect(ng, 0, 0, 1210, 330, 26); ng.fill();
      if (tiger) { ng.fillStyle = PAL.red; ng.fillRect(0, 0, 26, 330); }
      ng.fillStyle = "rgba(31,43,34,0.55)"; fitText(ng, pos, 105, 168, 140, 120, 700, FONT_TITLE, "center");
      ng.fillStyle = PAL.ink; fitText(ng, name, 190, 172, 990, 168, 700, FONT_TITLE, "left", 0.02);
      this.flips["name" + i] = this.flipPanel(R, nc, nameW, rowH, -W / 2 + 0.12 + nameW / 2, y);
      // score panel
      const [sc, sg] = canvas(470, 330);
      sg.fillStyle = tiger ? PAL.red : PAL.paper; roundRect(sg, 0, 0, 470, 330, 26); sg.fill();
      sg.fillStyle = tiger ? "#ffffff" : PAL.ink; fitText(sg, score, 235, 176, 420, 250, 800, FONT_TITLE, "center");
      this.flips["score" + i] = this.flipPanel(R, sc, scoreW, rowH, W / 2 - 0.12 - scoreW / 2, y);
      void gap;
    }
    // "LAGER = BETER" sign hanging under the board
    const [lc, lg] = canvas(1000, 260);
    lg.fillStyle = PAL.sand; roundRect(lg, 0, 0, 1000, 260, 40); lg.fill();
    lg.fillStyle = PAL.ink; fitText(lg, "LAGER = BETER", 470, 136, 760, 150, 800, FONT_TITLE, "center", 0.04);
    // down arrow
    lg.fillStyle = PAL.red; lg.beginPath(); lg.moveTo(870, 80); lg.lineTo(950, 80); lg.lineTo(950, 140); lg.lineTo(985, 140); lg.lineTo(910, 215); lg.lineTo(835, 140); lg.lineTo(870, 140); lg.closePath(); lg.fill();
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.05), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex(lc), roughness: 0.8 }), wood]);
    sign.castShadow = true;
    this.tag.add(sign);
    this.tag.position.set(0.0, Y0 + 0.42, 0.06);
    R.add(this.tag);
    R.rotation.y = -Math.PI / 2; // face -x (back toward the tee)
  }
  private flipPanel(parent: THREE.Object3D, c: HTMLCanvasElement, w: number, h: number, x: number, y: number) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y + h / 2, 0.05);
    const back = mat("#2e5439");
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), [back, back, back, back, new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.75 }), back]);
    panel.position.y = -h / 2;
    panel.castShadow = true;
    pivot.add(panel);
    parent.add(pivot);
    return pivot;
  }
  /** flip a panel in: p 0 = folded up (hidden), 1 = shown */
  setFlip(key: string, p: number) {
    const g = this.flips[key];
    g.visible = p > 0.001;
    g.rotation.x = -(1 - p) * Math.PI * 0.5;
  }
  setTag(p: number, swing: number) {
    this.tag.visible = p > 0.001;
    this.tag.scale.setScalar(Math.max(0.001, p));
    this.tag.rotation.x = swing;
  }
}

// ---------------- the tiles ----------------
export const TILE = 2.0, TILE_H = 0.24, STEP = 2.4;
export type WinInfo = { name: string[]; n: number; major: boolean; usOpen?: boolean; tag?: string };
export const WINS: WinInfo[] = [
  { name: ["MERCEDES"], n: 1, major: false },
  { name: ["PEBBLE", "BEACH"], n: 2, major: false },
  { name: ["BAY HILL"], n: 3, major: false },
  { name: ["MEMORIAL"], n: 4, major: false },
  { name: ["U.S. OPEN"], n: 5, major: true, usOpen: true },
  { name: ["THE OPEN"], n: 6, major: true },
  { name: ["PGA", "CHAMPIONSHIP"], n: 7, major: true },
  { name: ["WGC-NEC"], n: 8, major: false },
  { name: ["CANADIAN", "OPEN"], n: 9, major: false },
];

const numberFace = (v: number) => {
  const [c, g] = canvas(512, 512);
  const tiger = v === -12, chase = v === 3;
  g.fillStyle = tiger ? PAL.red : chase ? PAL.slate : PAL.paper; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = tiger ? "rgba(255,255,255,0.35)" : chase ? "rgba(255,255,255,0.3)" : "rgba(31,43,34,0.14)"; g.lineWidth = 10;
  roundRect(g, 22, 22, 468, 468, 40); g.stroke();
  g.fillStyle = tiger || chase ? "#ffffff" : PAL.ink;
  if (v === 0) {
    fitText(g, "0", 256, 220, 440, 270, 800, FONT_TITLE, "center");
    g.fillStyle = "rgba(31,43,34,0.6)"; fitText(g, "PAR", 256, 400, 400, 84, 700, FONT_UI, "center", 0.2);
  } else fitText(g, fmt(v), 256, 268, 450, 300, 800, FONT_TITLE, "center");
  return c;
};

const flagIcon = (g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) => {
  g.fillStyle = color;
  g.fillRect(x, y, s * 0.06, s);
  g.beginPath(); g.moveTo(x + s * 0.06, y); g.lineTo(x + s * 0.62, y + s * 0.17); g.lineTo(x + s * 0.06, y + s * 0.34); g.closePath(); g.fill();
  g.beginPath(); g.ellipse(x + s * 0.03, y + s, s * 0.32, s * 0.07, 0, 0, 7); g.fill();
};

const winFace = (w: WinInfo) => {
  const [c, g] = canvas(512, 512);
  g.fillStyle = w.usOpen ? "#b81c28" : PAL.red; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = w.usOpen ? PAL.gold : "rgba(255,255,255,0.35)"; g.lineWidth = w.usOpen ? 22 : 10;
  roundRect(g, 22, 22, 468, 468, 40); g.stroke();
  g.fillStyle = "rgba(255,255,255,0.85)"; fitText(g, w.tag ?? `#${w.n}`, 70, 84, 160, 60, 700, FONT_UI, "left");
  if (w.major) { g.fillStyle = PAL.gold; fitText(g, "MAJOR", 442, 84, 220, 50, 800, FONT_UI, "right", 0.12); }
  flagIcon(g, 222, 128, 120, "#ffffff");
  g.fillStyle = "#ffffff";
  if (w.name.length === 1) fitText(g, w.name[0], 256, 360, 430, 118, 800, FONT_TITLE, "center", 0.02);
  else { fitText(g, w.name[0], 256, 330, 430, 96, 800, FONT_TITLE, "center", 0.02); fitText(g, w.name[1], 256, 420, 430, 74, 700, FONT_TITLE, "center", 0.04); }
  return c;
};

export class Tile {
  g = new THREE.Group();     // placed in world
  box: THREE.Mesh;
  winMat: THREE.MeshStandardMaterial | null = null;
  constructor(public value: number, win?: WinInfo) {
    const side = mat(value === -12 ? PAL.redDeep : value === 3 ? "#5b6870" : "#e2dccb");
    const top = new THREE.MeshStandardMaterial({ map: tex(numberFace(value)), roughness: 0.7 });
    let bottom: THREE.Material = side;
    if (win) {
      const t = tex(winFace(win));
      this.winMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
      bottom = this.winMat;
    }
    const geo = new THREE.BoxGeometry(TILE, TILE_H, TILE);
    this.box = new THREE.Mesh(geo, [side, side, top, bottom, side, side]);
    this.box.castShadow = true; this.box.receiveShadow = true;
    this.g.add(this.box);
  }
}

// ---------------- placards for the slam ----------------
export const placard = (title: string, year: string) => {
  const g = new THREE.Group();
  const [c, x] = canvas(640, 420);
  x.fillStyle = PAL.paper; roundRect(x, 0, 0, 640, 420, 30); x.fill();
  x.fillStyle = PAL.ink; fitText(x, title, 320, 110, 580, 92, 800, FONT_TITLE, "center", 0.03);
  x.fillStyle = PAL.red; fitText(x, year, 320, 285, 580, 220, 800, FONT_TITLE, "center", 0.02);
  const card = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.05), [mat(PAL.offWhite), mat(PAL.offWhite), mat(PAL.offWhite), mat(PAL.offWhite), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.75 }), mat(PAL.offWhite)]);
  card.position.y = 0.5; card.rotation.x = -0.5; card.castShadow = true;
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.05), mat("#3a3a3a"));
  leg.position.set(0, 0.15, -0.12);
  g.add(card, leg);
  return g;
};

// ---------------- trophies (simple, distinct silhouettes) ----------------
let envTex: THREE.Texture | null = null;
export const setEnv = (t: THREE.Texture) => { envTex = t; };
const silver = () => new THREE.MeshStandardMaterial({ color: "#e3e4e2", metalness: 0.92, roughness: 0.22, envMap: envTex, envMapIntensity: 1.25 });
const gold = () => new THREE.MeshStandardMaterial({ color: "#e0b45c", metalness: 0.9, roughness: 0.25, envMap: envTex, envMapIntensity: 1.2 });
const lathe = (pts: [number, number][], m: THREE.Material) => {
  const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh;
};
const handle = (r: number, tube: number, m: THREE.Material, x: number, y: number, flip = 1, arc = Math.PI) => {
  const h = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 20, arc), m);
  h.position.set(x, y, 0); h.rotation.z = flip > 0 ? -Math.PI / 2 : Math.PI / 2; h.castShadow = true; return h;
};
const base = (w: number, h: number) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(w, w * 1.08, h, 28), mat("#1d1d1f", { roughness: 0.5 })); b.position.y = h / 2; b.castShadow = true; return b; };

export const trophy = (kind: "usopen" | "open" | "pga" | "masters") => {
  const g = new THREE.Group();
  const s = silver();
  if (kind === "usopen") { // urn with two handles and a lidded top
    g.add(base(0.2, 0.12));
    const body = lathe([[0, 0.12], [0.08, 0.13], [0.05, 0.2], [0.07, 0.26], [0.17, 0.36], [0.2, 0.5], [0.17, 0.62], [0.12, 0.66], [0.15, 0.7], [0.11, 0.74], [0.05, 0.8], [0.03, 0.86], [0.05, 0.9], [0, 0.93]], s);
    g.add(body, handle(0.09, 0.016, s, 0.2, 0.5, 1), handle(0.09, 0.016, s, -0.2, 0.5, -1));
  } else if (kind === "open") { // claret jug: pear body, tall neck, one handle, spout
    g.add(base(0.17, 0.08));
    const body = lathe([[0, 0.08], [0.1, 0.09], [0.07, 0.13], [0.17, 0.24], [0.19, 0.33], [0.15, 0.43], [0.07, 0.53], [0.055, 0.66], [0.075, 0.74], [0.06, 0.76], [0, 0.78]], s);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 8, 20, Math.PI * 1.1), s);
    h.position.set(-0.13, 0.52, 0); h.rotation.z = Math.PI / 2 + 0.2; h.castShadow = true;
    const spout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 10), s); spout.position.set(0.085, 0.75, 0); spout.rotation.z = -1.1;
    g.add(body, h, spout);
  } else if (kind === "pga") { // Wanamaker: big wide cup, large ear handles, domed lid
    g.add(base(0.22, 0.12));
    const body = lathe([[0, 0.12], [0.07, 0.13], [0.05, 0.2], [0.1, 0.26], [0.24, 0.36], [0.27, 0.48], [0.25, 0.56], [0.27, 0.58], [0.2, 0.62], [0.12, 0.68], [0.06, 0.73], [0.04, 0.8], [0, 0.82]], s);
    g.add(body, handle(0.13, 0.02, s, 0.26, 0.45, 1, Math.PI * 1.2), handle(0.13, 0.02, s, -0.26, 0.45, -1, Math.PI * 1.2));
  } else { // Masters: silver clubhouse model on a green plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.42), mat("#1e5a36", { roughness: 0.6 }));
    plinth.position.y = 0.05; plinth.castShadow = true; g.add(plinth);
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 0.3), s); house.position.y = 0.22; house.castShadow = true;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.2, 0.5, 4, 1), s);
    roof.rotation.set(0, Math.PI / 4, Math.PI / 2); roof.scale.set(1, 1, 0.8); roof.position.y = 0.42;
    const roofA = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.04, 0.36), s); roofA.position.y = 0.355;
    const cupola = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), s); cupola.position.y = 0.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.1, 4), s); cap.position.y = 0.61; cap.rotation.y = Math.PI / 4;
    const flagP = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.18, 6), gold()); flagP.position.y = 0.72;
    for (const x of [-0.18, -0.06, 0.06, 0.18]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8), s); col.position.set(x, 0.2, 0.17); g.add(col); }
    g.add(house, roof, roofA, cupola, cap, flagP);
    void roof;
  }
  g.scale.setScalar(1.25);
  return g;
};

export const pedestal = (h: number, r = 0.42) => {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, h, 32), mat(PAL.offWhite, { roughness: 0.6 }));
  p.position.y = h / 2; p.castShadow = true; p.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.07, r * 1.07, 0.06, 32), mat(PAL.red));
  ring.position.y = h - 0.05;
  g.add(p, ring);
  return g;
};

export const label = (text: string, w: number, h: number, size: number, color = PAL.ink, bg: string | null = null, weight = 800) => {
  const pxW = 1024, pxH = Math.round((1024 * h) / w);
  const [c, g] = canvas(pxW, pxH);
  if (bg) { g.fillStyle = bg; roundRect(g, 0, 0, pxW, pxH, pxH * 0.2); g.fill(); }
  g.fillStyle = color; fitText(g, text, pxW / 2, pxH / 2 + pxH * 0.03, pxW * 0.92, size, weight, FONT_TITLE, "center", 0.05);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex(c), transparent: !bg, roughness: 0.8, depthWrite: !!bg }));
  m.receiveShadow = true;
  return m;
};
