// The Pebble Beach-like diorama: a cut-out island of course on the ocean, fairway along +x (tee at x = 0,
// green at x = 36), bunkers, mounds, Monterey cypresses on the cliff side (-z), a headland across the bay.
import * as THREE from "three";
import { PAL, mat, grassTex, sandTex, soilTex, seaTex } from "./look";
import { rng } from "../lib/anim";

export const GREEN_C = new THREE.Vector3(36.6, 0, 0.3);
export const HOLE = new THREE.Vector3(37.0, 0, -2.4);
export const BOARD_X = 42.6;

const blobShape = (cx: number, cz: number, rx: number, rz: number, seed: number, n = 28, wob = 0.18) => {
  const r = rng(seed);
  const ph = [r() * 6, r() * 6, r() * 6];
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + wob * (0.5 * Math.sin(2 * a + ph[0]) + 0.3 * Math.sin(3 * a + ph[1]) + 0.2 * Math.sin(5 * a + ph[2]));
    const x = cx + Math.cos(a) * rx * k, y = -(cz + Math.sin(a) * rz * k);
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
};
/** flat shape on the ground (ShapeGeometry lies in XY; rotate to XZ with +y up) */
const flat = (shape: THREE.Shape, m: THREE.Material, y: number, uvScale = 0.08) => {
  const g = new THREE.ShapeGeometry(shape, 24);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * uvScale, p.getY(i) * uvScale);
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = true;
  return mesh;
};

const roundedRect = (x0: number, z0: number, x1: number, z1: number, r: number) => {
  const s = new THREE.Shape();
  // in shape space y = -z
  const a = x0, b = -z1, c = x1, d = -z0;
  s.moveTo(a + r, b); s.lineTo(c - r, b); s.quadraticCurveTo(c, b, c, b + r); s.lineTo(c, d - r); s.quadraticCurveTo(c, d, c - r, d);
  s.lineTo(a + r, d); s.quadraticCurveTo(a, d, a, d - r); s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b);
  return s;
};

const cypress = (r: () => number, scale: number) => {
  const g = new THREE.Group();
  const bark = mat("#5b4636", { roughness: 1 });
  const leafA = mat("#2f4f2c"), leafB = mat("#38603a"), leafC = mat("#294628");
  const lean = (r() - 0.5) * 0.5;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 3.2, 8), bark);
  trunk.position.y = 1.5; trunk.rotation.z = lean; trunk.castShadow = true; g.add(trunk);
  const top = new THREE.Vector3(-Math.sin(lean) * 3.0, 3.0, 0);
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), [leafA, leafB, leafC][i % 3]);
    const a = (i / n) * Math.PI * 2 + r();
    const rad = 0.6 + r() * 1.2;
    c.position.set(top.x + Math.cos(a) * rad * 1.2, top.y + 0.2 + r() * 0.7, Math.sin(a) * rad * 0.8);
    c.scale.set(1.3 + r() * 0.8, 0.55 + r() * 0.25, 1.1 + r() * 0.6);
    c.rotation.y = r() * 3;
    c.castShadow = true; g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
};

const roundTree = (r: () => number, scale: number) => {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 8), mat("#5e4838"));
  trunk.position.y = 0.8; trunk.castShadow = true; g.add(trunk);
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), mat(r() > 0.5 ? "#3b6236" : "#456f3c"));
  crown.position.y = 2.3; crown.scale.set(1, 1.15, 1); crown.castShadow = true; g.add(crown);
  g.scale.setScalar(scale);
  return g;
};

export class Course {
  root = new THREE.Group();
  flag: THREE.Mesh;
  private flagGeo: THREE.PlaneGeometry;
  private flagBase: Float32Array;
  sea: THREE.Mesh;

  constructor() {
    const R = this.root;
    // island block with soil sides
    const top = roundedRect(-16, -11, 52, 12, 5);
    const block = new THREE.ExtrudeGeometry(top, { depth: 4.2, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 16 });
    const roughM = mat("#ffffff", { map: grassTex(PAL.rough, 3) });
    (roughM.map as THREE.Texture).repeat.set(0.05, 0.05);
    const soilM = mat("#ffffff", { map: soilTex() });
    // side UVs: map v to depth
    const pos = block.attributes.position, uv = block.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      uv.setXY(i, (pos.getX(i) + pos.getY(i)) * 0.15, (z + 0.25) / 4.7);
    }
    const island = new THREE.Mesh(block, [roughM, soilM]);
    // caps use group 0 with planar uv: overwrite cap uv in world units
    island.rotation.x = -Math.PI / 2; // extrusion points up, shape y = -world z
    island.position.y = -4.47;
    island.receiveShadow = true;
    R.add(island);
    // a grass top lying exactly at y = 0 (the extrude cap sits under the bevel)
    const topMesh = flat(top, mat("#ffffff", { map: grassTex(PAL.rough, 4) }), 0.0, 0.06);
    R.add(topMesh);

    // sea + foam
    const seaM = mat("#ffffff", { map: seaTex(), roughness: 0.35, metalness: 0.05 });
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), seaM);
    this.sea.rotation.x = -Math.PI / 2; this.sea.position.y = -2.6; this.sea.receiveShadow = true;
    R.add(this.sea);
    const foam = flat(roundedRect(-17.3, -12.3, 53.3, 13.3, 6), new THREE.MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0.55 }), -2.57);
    R.add(foam);
    // rocks at the waterline on the cliff side and the far end
    const r = rng(11);
    const rockM = [mat(PAL.rock), mat("#958b7d"), mat("#b5ac9e")];
    for (let i = 0; i < 46; i++) {
      const side = i % 3;
      const x = side === 2 ? 52.5 + r() * 2 : -16 + r() * 68;
      const z = side === 2 ? -10 + r() * 20 : side === 0 ? -11.6 - r() * 1.8 : 12.4 + r() * 1.6;
      const s = 0.5 + r() * 1.3;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockM[i % 3]);
      rock.position.set(x, -2.6 + s * 0.35, z); rock.rotation.set(r() * 3, r() * 3, r() * 3); rock.scale.y = 0.7;
      rock.castShadow = true; R.add(rock);
    }

    // fairway: a soft band along x with gentle width changes
    const fw = new THREE.Shape();
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const x = -3 + (i / 40) * 37;
      const w = 3.4 + 0.9 * Math.sin(i * 0.35) + (x > 26 ? 1.0 : 0);
      const c = 0.6 * Math.sin(x * 0.11);
      pts.push([x, c + w]);
    }
    fw.moveTo(pts[0][0], -pts[0][1]);
    pts.forEach(([x, z]) => fw.lineTo(x, -z));
    for (let i = 40; i >= 0; i--) {
      const x = -3 + (i / 40) * 37;
      const w = 3.4 + 0.9 * Math.cos(i * 0.31) + (x > 26 ? 1.0 : 0);
      fw.lineTo(x, -(0.6 * Math.sin(x * 0.11) - w));
    }
    const fwTex = grassTex(PAL.fairway, 21, 14);
    R.add(flat(fw, mat("#ffffff", { map: fwTex }), 0.01, 0.055));

    // tee box
    R.add(flat(roundedRect(-2.2, -2.0, 2.2, 2.0, 0.6), mat("#ffffff", { map: grassTex(PAL.tee, 31, 8) }), 0.02, 0.22));
    for (const z of [-1.5, 1.5]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 12), mat("#2f3f5c"));
      m.position.set(1.6, 0.07, z * 1.1); m.castShadow = true; R.add(m);
    }

    // green + fringe + hole + flag
    R.add(flat(blobShape(GREEN_C.x, GREEN_C.z, 5.8, 5.0, 41, 32, 0.08), mat("#ffffff", { map: grassTex("#77a24f", 42) }), 0.015, 0.1));
    R.add(flat(blobShape(GREEN_C.x, GREEN_C.z, 5.0, 4.3, 41, 32, 0.08), mat("#ffffff", { map: grassTex(PAL.green, 43, 10) }), 0.02, 0.1));
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), mat("#1b241c"));
    hole.rotation.x = -Math.PI / 2; hole.position.set(HOLE.x, 0.026, HOLE.z); R.add(hole);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8), mat(PAL.offWhite));
    pole.position.set(HOLE.x, 1.2, HOLE.z); pole.castShadow = true; R.add(pole);
    this.flagGeo = new THREE.PlaneGeometry(0.75, 0.5, 8, 2);
    this.flagGeo.translate(0.375, 0, 0);
    this.flagBase = Float32Array.from(this.flagGeo.attributes.position.array as Float32Array);
    this.flag = new THREE.Mesh(this.flagGeo, mat("#f1d36b", { side: THREE.DoubleSide }));
    this.flag.position.set(HOLE.x, 2.12, HOLE.z); this.flag.castShadow = true; R.add(this.flag);

    // bunkers (slightly sunken sand with a darker lip)
    const sandM = mat("#ffffff", { map: sandTex() });
    const lipM = mat(PAL.sandShade);
    const bunkers: [number, number, number, number, number][] = [[11.5, -5.0, 2.2, 1.3, 51], [21.5, 5.4, 2.6, 1.4, 52], [30.8, -5.1, 2.0, 1.5, 53], [40.4, 4.6, 1.9, 1.3, 54], [33.4, 5.8, 1.6, 1.0, 55], [6.0, 4.6, 1.5, 0.9, 56]];
    for (const [x, z, rx, rz, s] of bunkers) {
      R.add(flat(blobShape(x, z, rx + 0.2, rz + 0.18, s), lipM, 0.012, 0.2));
      R.add(flat(blobShape(x, z, rx, rz, s), sandM, 0.018, 0.25));
    }

    // mounds for height variation (half-buried flattened spheres in rough grass)
    const moundM = mat("#ffffff", { map: grassTex(PAL.roughDark, 61) });
    (moundM.map as THREE.Texture).repeat.set(2, 2);
    const mounds: [number, number, number, number][] = [[-9, 7, 4.5, 1.6], [4, 9.2, 4, 1.4], [15, 8.8, 5, 1.8], [27, 9, 4.2, 1.3], [44, 8.5, 4.5, 1.7], [-10, -6.5, 4, 1.8], [9, -8.4, 5, 1.6], [21, -8.6, 4.4, 1.9], [46, -7.5, 4.6, 1.5], [49.5, 1.0, 3.2, 1.2]];
    for (const [x, z, rr, h] of mounds) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), moundM);
      m.position.set(x, -0.02, z); m.scale.set(rr, h, rr * 0.75); m.receiveShadow = true; m.castShadow = true; R.add(m);
    }

    // trees: Monterey cypresses along the cliff side, a few round trees on the near side
    const tr = rng(71);
    const cyp: [number, number, number][] = [[-12, -8.8, 1.1], [-5, -9.6, 0.95], [3, -9.8, 1.2], [13.5, -9.6, 1.0], [17, -10, 0.85], [26, -9.7, 1.15], [35, -9.4, 1.0], [41, -9.9, 1.25], [48, -8.8, 1.0], [-14, 1, 1.0], [51, -3, 0.9]];
    for (const [x, z, s] of cyp) { const c = cypress(tr, s); c.position.set(x, 0, z); c.rotation.y = tr() * 6; R.add(c); }
    const rnd: [number, number, number][] = [[-12, 9.5, 0.9], [10, 10.5, 0.8], [33, 10.2, 0.85], [48, 9.8, 0.95], [-6, 10.4, 0.7]];
    for (const [x, z, s] of rnd) { const c = roundTree(tr, s); c.position.set(x, 0, z); R.add(c); }

    // headland across the bay + a far ridge (soft, fogged)
    const hillM = mat("#6f8f63"), hillM2 = mat("#86a07a");
    const hills: [number, number, number, number, number, THREE.Material][] = [[10, -95, 70, 14, 30, hillM], [90, -120, 60, 20, 34, hillM2], [-60, -110, 60, 16, 30, hillM2], [140, -40, 40, 12, 40, hillM], [150, 40, 50, 10, 40, hillM2]];
    for (const [x, z, rx, h, rz, m] of hills) {
      const hm = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m);
      hm.position.set(x, -2.7, z); hm.scale.set(rx, h, rz); R.add(hm);
    }
    // a few soft clouds
    const cloudM = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, emissive: "#ffffff", emissiveIntensity: 0.35, fog: true });
    const cr = rng(91);
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 4; k++) {
        const c = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), cloudM);
        c.position.set(k * 3 - 4.5, cr() * 1.5, cr() * 2); c.scale.set(3 + cr() * 2, 1.3 + cr(), 2.5); g.add(c);
      }
      g.position.set(-60 + cr() * 220, 34 + cr() * 22, -160 + cr() * 130);
      g.scale.setScalar(1.5 + cr() * 1.5);
      R.add(g);
    }
  }

  update(t: number) {
    // flag ripple
    const p = this.flagGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = this.flagBase[i * 3];
      p.setZ(i, Math.sin(x * 6 - t * 7) * 0.06 * x);
    }
    p.needsUpdate = true;
    const m = this.sea.material as THREE.MeshStandardMaterial;
    m.map!.offset.set(t * 0.004, t * 0.0025);
  }
}

/** sky dome: vertical gradient from warm off-white at the horizon to soft blue */
export const skyDome = () => {
  const g = new THREE.SphereGeometry(700, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(PAL.skyTop) }, hor: { value: new THREE.Color(PAL.horizon) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float h = normalize(vP).y; float k = smoothstep(-0.02, 0.45, h); gl_FragColor = vec4(mix(hor, top, pow(k, 0.8)), 1.0); }",
  });
  const s = new THREE.Mesh(g, m);
  s.renderOrder = -1;
  return s;
};
