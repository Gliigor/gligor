// Miniature 3D figures ("poppetjes"): a bean body, a big round head with a cap, capsule limbs driven by two-bone IK.
// The figure faces +z in its own space, +x is its LEFT side. A pose is a plain object; every frame the figure is
// re-posed from scratch, so the same time always gives the same picture.
import * as THREE from "three";
import { mat, blobMesh, PAL } from "./look";
import { V3, clamp, lerp, smooth, smoother, easeIn, easeOut } from "../lib/anim";

export type Look = {
  skin: string; shirt: string; pants: string; shoes: string; sole?: string;
  cap: string | null; hair: string; hairStyle: "short" | "ponytail";
  glove?: boolean; collar?: string; belt?: string;
};

export type Pose = {
  pelvis: V3;           // offset of the pelvis from its rest point (x, y, z)
  hipYaw: number;
  torsoYaw: number;     // absolute (root space)
  torsoPitch: number;   // + bends forward
  torsoRoll: number;
  headYaw: number; headPitch: number; headRoll: number; // relative to torso
  handL: V3; handR: V3;           // root-space targets
  poleL?: V3; poleR?: V3;         // elbow pole directions
  footL: V3; footR: V3;           // ankle positions (root space)
  heelL?: number; heelR?: number; // heel lift (rad)
  footYawL?: number; footYawR?: number;
  club?: { hand: "L" | "R"; dir: V3 } | null;
  fistR?: number;       // 0..1 closes the right hand
  blink?: number;
  lookAt?: V3 | null;   // world-space point the head turns toward (overrides head yaw/pitch, clamped)
};

// body dimensions (m-ish; a figure is ~1.76 tall with a big head)
export const DIM = {
  ankle: 0.07, shin: 0.36, thigh: 0.37, hip: 0.78, hipW: 0.105,
  shoulderY: 0.43, shoulderW: 0.205, neckY: 0.5, headR: 0.235,
  upper: 0.27, fore: 0.27, club: 0.98,
};

const Y = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3(), tmpD = new THREE.Vector3();

/** analytic two-bone IK: from S to T with bone lengths a, b; pole bends the joint. Writes joint E and end T2. */
const ik2 = (S: THREE.Vector3, T: THREE.Vector3, a: number, b: number, pole: THREE.Vector3, E: THREE.Vector3, T2: THREE.Vector3) => {
  const d = tmpA.subVectors(T, S);
  let L = d.length();
  const dir = d.normalize();
  L = clamp(L, Math.abs(a - b) + 1e-3, a + b - 1e-3);
  T2.copy(S).addScaledVector(dir, L);
  const x = (a * a - b * b + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const perp = tmpB.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (perp.lengthSq() < 1e-6) perp.set(0, 0, 1).addScaledVector(dir, -dir.z);
  perp.normalize();
  E.copy(S).addScaledVector(dir, x).addScaledVector(perp, h);
};

/** a capsule bone hung on a group whose +Y runs from joint A to joint B */
class Bone {
  g = new THREE.Group();
  constructor(parent: THREE.Object3D, len: number, r: number, m: THREE.Material, r2?: number, extra?: (g: THREE.Group) => void) {
    const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - (r + (r2 ?? r)) * 0.4), 6, 12);
    if (r2 !== undefined) { // taper
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = lerp(r2 / r, 1, clamp((y + len / 2) / len)); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }
      geo.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = len / 2;
    mesh.castShadow = true;
    this.g.add(mesh);
    extra?.(this.g);
    parent.add(this.g);
  }
  span(A: THREE.Vector3, B: THREE.Vector3) {
    this.g.position.copy(A);
    this.g.quaternion.setFromUnitVectors(Y, tmpC.subVectors(B, A).normalize());
  }
}

export class Figure {
  root = new THREE.Group();     // placed in the world (position, yaw)
  body = new THREE.Group();     // everything that is not the contact shadow
  pelvis = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  private shL = new THREE.Object3D(); private shR = new THREE.Object3D();
  private hipL = new THREE.Object3D(); private hipR = new THREE.Object3D();
  private upL: Bone; private foL: Bone; private upR: Bone; private foR: Bone;
  private thL: Bone; private shinL: Bone; private thR: Bone; private shinR: Bone;
  private handLM: THREE.Mesh; private handRM: THREE.Mesh;
  private shoeL = new THREE.Group(); private shoeR = new THREE.Group();
  private eyes: THREE.Mesh[] = [];
  club = new THREE.Group();
  blob: THREE.Mesh;
  /** world-space positions of the hands and club head after the last pose() */
  handWorldL = new THREE.Vector3(); handWorldR = new THREE.Vector3(); clubHeadWorld = new THREE.Vector3();

  constructor(public look: Look, withClub = false) {
    const skin = mat(look.skin, { roughness: 0.7 });
    const shirt = mat(look.shirt, { roughness: 0.9 });
    const pants = mat(look.pants, { roughness: 0.92 });
    const shoe = mat(look.shoes, { roughness: 0.6 });
    const sole = mat(look.sole ?? "#efeae0", { roughness: 0.8 });
    this.root.add(this.body);
    this.body.add(this.pelvis);
    this.pelvis.add(this.torso);
    this.torso.add(this.head);

    // hips / pants
    const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.07, 6, 14), pants);
    hips.scale.set(1.12, 1, 0.82); hips.rotation.z = Math.PI / 2; hips.castShadow = true;
    hips.position.y = 0.02;
    this.pelvis.add(hips);
    if (look.belt) {
      const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.168, 0.168, 0.035, 20), mat(look.belt));
      belt.scale.set(1.08, 1, 0.84); belt.position.y = 0.09; this.torso.add(belt);
    }
    // torso: a soft bean in the shirt colour
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 0.24, 8, 18), shirt);
    chest.scale.set(1.1, 1, 0.8); chest.position.y = 0.28; chest.castShadow = true;
    this.torso.add(chest);
    // polo collar
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 8, 18), mat(look.collar ?? look.shirt));
    collar.rotation.x = Math.PI / 2 - 0.25; collar.position.set(0, 0.485, 0.012); this.torso.add(collar);
    // neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), skin);
    neck.position.y = 0.5; this.torso.add(neck);

    // head
    this.head.position.y = DIM.neckY;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(DIM.headR, 28, 20), skin);
    skull.scale.set(0.96, 1.0, 0.98); skull.position.y = 0.2; skull.castShadow = true;
    this.head.add(skull);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
      ear.scale.set(0.55, 1, 0.8); ear.position.set(s * DIM.headR * 0.95, 0.19, -0.01); this.head.add(ear);
      const eye = new THREE.Group();
      const white = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), mat("#f7f4ee", { roughness: 0.4 }));
      white.scale.set(0.8, 1.12, 0.45);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), mat("#141414", { roughness: 0.3 }));
      pupil.scale.set(0.95, 1.2, 0.5); pupil.position.set(0, -0.004, 0.012);
      eye.add(white, pupil);
      eye.position.set(s * 0.082, 0.205, DIM.headR * 0.915); eye.rotation.y = s * 0.3; this.head.add(eye); this.eyes.push(eye as unknown as THREE.Mesh);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), skin);
    nose.scale.set(0.9, 0.8, 0.9); nose.position.set(0, 0.15, DIM.headR * 0.98); this.head.add(nose);
    const hairM = mat(look.hair, { roughness: 0.95 });
    if (look.cap) {
      const capM = mat(look.cap, { roughness: 0.75 });
      const crown = new THREE.Mesh(new THREE.SphereGeometry(DIM.headR * 1.035, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), capM);
      crown.position.y = 0.245; crown.rotation.x = -0.12; crown.castShadow = true; this.head.add(crown);
      const band = new THREE.Mesh(new THREE.TorusGeometry(DIM.headR * 0.93, 0.012, 6, 32), mat(look.cap === "#141414" ? "#3a3a3c" : "#bdb6a8"));
      band.rotation.x = Math.PI / 2 - 0.12; band.position.set(0, 0.305, -0.01); this.head.add(band);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.035, 0.02), mat(look.skin)); strap.position.set(0, 0.29, -DIM.headR * 0.98); this.head.add(strap);
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), mat("#f3eee2", { roughness: 0.6 })); logo.position.set(0, 0.37, DIM.headR * 0.92); logo.rotation.x = -0.45; this.head.add(logo);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.022, 24, 1, false, -Math.PI / 2, Math.PI), capM);
      brim.scale.set(1, 1, 1.15); brim.position.set(0, 0.225, 0.175); brim.rotation.x = 0.1; brim.castShadow = true; this.head.add(brim);
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), capM); button.position.set(0, 0.46, -0.03); this.head.add(button);
      // short hair at the back under the cap
      const back = new THREE.Mesh(new THREE.SphereGeometry(DIM.headR * 1.01, 20, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.12), hairM);
      back.position.y = 0.2; back.rotation.x = -0.75; this.head.add(back);
    } else {
      const hair = new THREE.Mesh(new THREE.SphereGeometry(DIM.headR * 1.045, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
      hair.position.y = 0.205; hair.rotation.x = -0.28; hair.castShadow = true; this.head.add(hair);
      if (look.hairStyle === "ponytail") {
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.16, 6, 10), hairM);
        tail.position.set(0, 0.12, -0.25); tail.rotation.x = 0.35; this.head.add(tail);
      }
    }

    // arms (shoulder markers live on the torso; bones are posed in root space)
    this.shL.position.set(DIM.shoulderW, DIM.shoulderY, 0); this.shR.position.set(-DIM.shoulderW, DIM.shoulderY, 0);
    this.torso.add(this.shL, this.shR);
    const sleeve = (g: THREE.Group) => { const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.07, 6, 12), shirt); s.position.y = 0.06; s.castShadow = true; g.add(s); };
    this.upL = new Bone(this.body, DIM.upper, 0.05, skin, 0.045, sleeve);
    this.upR = new Bone(this.body, DIM.upper, 0.05, skin, 0.045, sleeve);
    this.foL = new Bone(this.body, DIM.fore, 0.046, skin, 0.04);
    this.foR = new Bone(this.body, DIM.fore, 0.046, skin, 0.04);
    this.handLM = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), look.glove ? mat("#f4f1ea", { roughness: 0.8 }) : skin);
    this.handRM = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), skin);
    this.handLM.castShadow = this.handRM.castShadow = true;
    this.body.add(this.handLM, this.handRM);

    // legs
    this.hipL.position.set(DIM.hipW, -0.03, 0); this.hipR.position.set(-DIM.hipW, -0.03, 0);
    this.pelvis.add(this.hipL, this.hipR);
    this.thL = new Bone(this.body, DIM.thigh, 0.082, pants, 0.072);
    this.thR = new Bone(this.body, DIM.thigh, 0.082, pants, 0.072);
    this.shinL = new Bone(this.body, DIM.shin, 0.07, pants, 0.064);
    this.shinR = new Bone(this.body, DIM.shin, 0.07, pants, 0.064);
    for (const g of [this.shoeL, this.shoeR]) {
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.12, 6, 12), shoe);
      up.rotation.x = Math.PI / 2; up.scale.set(1, 1, 0.75); up.position.set(0, -0.012, 0.055); up.castShadow = true;
      const so = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 0.25), sole);
      so.position.set(0, -0.058, 0.055);
      g.add(up, so); this.body.add(g);
    }

    // club: grip + shaft + head; its group's +Y points from the grip to the club head
    if (withClub) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.019, 0.24, 8), mat("#1b1b1b"));
      grip.position.y = 0.07;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, DIM.club, 8), mat("#c9ccd0", { metalness: 0.6, roughness: 0.35 }));
      shaft.position.y = DIM.club / 2;
      const headM = mat("#202226", { metalness: 0.4, roughness: 0.4 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), headM);
      head.scale.set(0.8, 0.55, 1.25); head.position.set(0, DIM.club + 0.02, 0.045);
      grip.castShadow = shaft.castShadow = head.castShadow = true;
      this.club.add(grip, shaft, head);
      this.body.add(this.club);
    }
    this.blob = blobMesh(0.95, 0.55);
    this.blob.position.y = 0.012;
    this.root.add(this.blob);
  }

  private E = new THREE.Vector3(); private T2 = new THREE.Vector3();
  private S = new THREE.Vector3(); private pole = new THREE.Vector3();

  /** shoulder / hip joint in root space (after the torso transform) */
  private joint(o: THREE.Object3D, out: THREE.Vector3) {
    o.getWorldPosition(out);
    return this.root.worldToLocal(out);
  }

  pose(p: Pose) {
    // pelvis + torso + head
    this.pelvis.position.set(p.pelvis[0], DIM.hip + p.pelvis[1], p.pelvis[2]);
    this.pelvis.rotation.set(0, p.hipYaw, 0, "YXZ");
    this.torso.rotation.set(p.torsoPitch, p.torsoYaw - p.hipYaw, p.torsoRoll, "YXZ");
    this.head.rotation.set(p.headPitch, p.headYaw, p.headRoll, "YXZ");
    this.root.updateMatrixWorld(true);
    if (p.lookAt) {
      // turn the head toward a world point, within neck limits
      const hp = this.head.getWorldPosition(tmpD);
      const target = new THREE.Vector3(...p.lookAt);
      const inv = new THREE.Matrix4().copy(this.torso.matrixWorld).invert();
      const local = target.applyMatrix4(inv).sub(this.head.position).sub(new THREE.Vector3(0, 0.2, 0));
      void hp;
      const yaw = clamp(Math.atan2(local.x, local.z), -1.25, 1.25);
      const pitch = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.7, 0.75);
      this.head.rotation.set(pitch + p.headPitch * 0.3, yaw, p.headRoll, "YXZ");
      this.root.updateMatrixWorld(true);
    }
    // arms
    const arm = (sh: THREE.Object3D, hand: V3, poleV: V3, up: Bone, fo: Bone, hm: THREE.Mesh) => {
      this.joint(sh, this.S);
      this.pole.set(...poleV);
      ik2(this.S, new THREE.Vector3(...hand), DIM.upper, DIM.fore, this.pole, this.E, this.T2);
      up.span(this.S, this.E); fo.span(this.E, this.T2);
      hm.position.copy(this.T2);
      return this.T2.clone();
    };
    const hL = arm(this.shL, p.handL, p.poleL ?? [0.4, -0.3, -0.6], this.upL, this.foL, this.handLM);
    const hR = arm(this.shR, p.handR, p.poleR ?? [-0.4, -0.3, -0.6], this.upR, this.foR, this.handRM);
    const fist = p.fistR ?? 0;
    this.handRM.scale.set(1 - 0.12 * fist, 1 - 0.12 * fist, 1 + 0.1 * fist);
    // legs: knees bend forward (+z, turned with the hips) and slightly out
    const leg = (hip: THREE.Object3D, foot: V3, th: Bone, sh: Bone, shoe: THREE.Group, side: number, heel: number, fyaw: number) => {
      this.joint(hip, this.S);
      this.pole.set(Math.sin(p.hipYaw) + side * 0.25, 0, Math.cos(p.hipYaw));
      const ankle = new THREE.Vector3(foot[0], foot[1] + heel * 0.09, foot[2]);
      ik2(this.S, ankle, DIM.thigh, DIM.shin, this.pole, this.E, this.T2);
      th.span(this.S, this.E); sh.span(this.E, this.T2);
      shoe.position.copy(this.T2);
      shoe.rotation.set(heel, fyaw, 0, "YXZ");
    };
    leg(this.hipL, p.footL, this.thL, this.shinL, this.shoeL, 1, p.heelL ?? 0, p.footYawL ?? 0.12);
    leg(this.hipR, p.footR, this.thR, this.shinR, this.shoeR, -1, p.heelR ?? 0, p.footYawR ?? -0.12);
    // blink: squash the eyes
    const b = p.blink ?? 0;
    for (const e of this.eyes) e.scale.y = Math.max(0.08, 1 - 0.92 * b);
    // club
    if (p.club && this.club.children.length) {
      const h = p.club.hand === "L" ? hL : hR;
      this.club.visible = true;
      this.club.position.copy(h).addScaledVector(new THREE.Vector3(...p.club.dir).normalize(), -0.06);
      const d = new THREE.Vector3(...p.club.dir).normalize();
      this.club.quaternion.setFromUnitVectors(Y, d);
      // keep the club face square-ish: roll around the shaft so the head's +z points along the figure's +x/+z
      this.root.updateMatrixWorld(true);
      this.clubHeadWorld.copy(this.club.position).addScaledVector(d, DIM.club + 0.02);
      this.root.localToWorld(this.clubHeadWorld);
    } else this.club.visible = false;
    this.root.localToWorld(this.handWorldL.copy(hL));
    this.root.localToWorld(this.handWorldR.copy(hR));
  }
}

// ---------------- pose library ----------------
export const blinkAt = (t: number, seed: number) => {
  // a 0.13 s blink every ~2.2-3.6 s, deterministic per figure
  const period = 2.2 + (seed % 7) * 0.2;
  const ph = ((t + seed * 0.77) % period) / 0.13;
  return ph < 1 ? Math.sin(ph * Math.PI) : 0;
};

/** relaxed stance with a slow weight shift and breathing */
export const idle = (t: number, seed = 0, weight = 0): Pose => {
  const sway = Math.sin(t * 0.9 + seed) * 0.5 + weight;
  const breathe = Math.sin(t * 1.7 + seed * 2) * 0.006;
  return {
    pelvis: [0.025 * sway, -0.012 + breathe, 0], hipYaw: 0.03 * sway, torsoYaw: 0.02 * Math.sin(t * 0.6 + seed),
    torsoPitch: 0.03 + breathe, torsoRoll: -0.03 * sway,
    headYaw: 0.12 * Math.sin(t * 0.45 + seed * 3), headPitch: 0.02 * Math.sin(t * 0.8 + seed), headRoll: 0.02 * sway,
    handL: [0.27, 0.74 + breathe, 0.03], handR: [-0.27, 0.74 + breathe, 0.03],
    poleL: [0.3, 0, -1], poleR: [-0.3, 0, -1],
    footL: [0.13, DIM.ankle, 0.02], footR: [-0.13, DIM.ankle, -0.02],
    blink: blinkAt(t, seed),
  };
};

/** blend two poses (numbers and vectors) */
export const blend = (a: Pose, b: Pose, t: number): Pose => {
  const u = clamp(t);
  if (u <= 0) return a;
  if (u >= 1) return b;
  const out = { ...a } as Record<string, unknown>;
  for (const k of Object.keys(b) as (keyof Pose)[]) {
    const va = a[k] as unknown, vb = b[k] as unknown;
    if (typeof va === "number" && typeof vb === "number") out[k] = lerp(va, vb, u);
    else if (Array.isArray(va) && Array.isArray(vb)) out[k] = va.map((x: number, i: number) => lerp(x, vb[i] as number, u));
    else if (k === "club") {
      const ca = a.club, cb = b.club;
      if (ca && cb) out.club = { hand: u < 0.5 ? ca.hand : cb.hand, dir: ca.dir.map((x, i) => lerp(x, cb.dir[i], u)) as V3 };
      else out.club = u < 0.5 ? ca : cb;
    } else if (k === "lookAt") {
      const la = a.lookAt, lb = b.lookAt;
      out.lookAt = la && lb ? (la.map((x, i) => lerp(x, lb[i], u)) as V3) : u < 0.5 ? la : lb;
    } else if (va === undefined) out[k] = vb;
  }
  return out as Pose;
};

// ---------------- the golf swing ----------------
// Hands travel on a circle in a tilted swing plane around the upper chest; the club hangs from the lead (left)
// hand along the radius, plus a wrist hinge that sets in the backswing, holds as lag in the downswing and
// releases through impact. The body turns with the hands, weight moves to the lead side, the trail heel lifts.
const SWING_C = new THREE.Vector3(0.0, 1.08, 0.16);
const HANDS0 = new THREE.Vector3(0.07, 0.7, 0.4);
const W0 = HANDS0.clone().sub(SWING_C);
const SWING_R = W0.length();
W0.normalize();
const U0 = new THREE.Vector3(-1, 0, 0).addScaledVector(W0, -new THREE.Vector3(-1, 0, 0).dot(W0)).normalize();
export const THETA_TOP = 2.35, THETA_FINISH = -2.7;
/** ball position in figure space (the club head at address) */
export const BALL_LOCAL: V3 = (() => { const p = HANDS0.clone().addScaledVector(W0, DIM.club - 0.02); return [p.x + 0.0, 0.055, p.z + 0.02]; })();

/**
 * Golf pose for swing angle theta (0 = address/impact, +THETA_TOP = top of the backswing, THETA_FINISH = finish).
 * phase: "back" (hinge setting), "down" (lag), "through".
 */
export const swingPose = (theta: number, phase: "back" | "down" | "through", t: number, seed = 0): Pose => {
  let hinge = 0;
  if (phase === "back") hinge = 1.5 * smooth((theta - 0.35) / 1.7);
  else if (phase === "down") hinge = 1.5 * smooth((theta - 0.05) / 1.25);
  else hinge = -1.35 * smooth((-theta - 0.35) / 1.6);
  const r = W0.clone().multiplyScalar(Math.cos(theta)).addScaledVector(U0, Math.sin(theta));
  const tan = W0.clone().multiplyScalar(-Math.sin(theta)).addScaledVector(U0, Math.cos(theta));
  // hands come in closer to the body at the top and finish (arms fold)
  const rad = SWING_R * (1 - 0.1 * smooth(Math.abs(theta) / 2.3));
  const hands = SWING_C.clone().addScaledVector(r, rad);
  if (hands.z < 0.02) hands.z = lerp(hands.z, 0.02, 0.6);
  const clubDir = r.clone().multiplyScalar(Math.cos(hinge)).addScaledVector(tan, Math.sin(hinge)).normalize();
  const back = clamp(theta / THETA_TOP, 0, 1), thru = clamp(-theta / -THETA_FINISH, 0, 1);
  const torsoYaw = -1.2 * back + 1.5 * smoother(thru);
  const hipYaw = -0.55 * back + 1.25 * smoother(thru);
  const pelvisX = -0.03 * back + 0.11 * smooth(thru * 1.6);
  // right hand sits just below the left on the grip
  const handR = hands.clone().addScaledVector(clubDir, 0.095);
  const breathe = Math.sin(t * 1.7 + seed) * 0.003;
  return {
    pelvis: [pelvisX, -0.07 + 0.05 * smoother(thru) + breathe, -0.05 + 0.03 * thru], hipYaw,
    torsoYaw, torsoPitch: lerp(0.42, 0.08, smoother(thru)) - 0.04 * back, torsoRoll: 0.08 * back - 0.16 * smoother(thru),
    headYaw: -0.12 * thru, headPitch: lerp(0.55, -0.1, smoother(thru)), headRoll: 0,
    handL: [hands.x, hands.y, hands.z], handR: [handR.x, handR.y, handR.z],
    poleL: [0.6, -0.6, 0.2], poleR: [-0.5, -0.9, -0.1],
    footL: [0.2, DIM.ankle, 0.0], footR: [-0.2, DIM.ankle, 0.0],
    heelL: 0, heelR: 0.75 * smooth(thru * 1.4), footYawL: 0.3, footYawR: -0.15 + 0.5 * smooth(thru * 1.4),
    club: { hand: "L", dir: [clubDir.x, clubDir.y, clubDir.z] },
    blink: 0,
  };
};

/** swing angle over time for a swing whose impact is at time ti; downswing 0.2 s, finish 0.55 s */
export const swingAt = (t: number, ti: number, backStart = -Infinity) => {
  const DOWN = 0.2, THRU = 0.6;
  if (t < ti - DOWN) {
    // backswing (or held at the top)
    const BACK = 0.95;
    const u = Number.isFinite(backStart) ? clamp((t - backStart) / BACK) : 1;
    return { theta: THETA_TOP * smoother(u), phase: "back" as const };
  }
  if (t < ti) return { theta: THETA_TOP * (1 - easeIn((t - (ti - DOWN)) / DOWN, 2.2)), phase: "down" as const };
  return { theta: THETA_FINISH * easeOut((t - ti) / THRU, 2.4), phase: "through" as const };
};

export const TIGER: Look = { skin: "#6a4330", shirt: PAL.red, pants: "#18181a", shoes: "#1a1a1a", sole: "#f1efe9", cap: "#141414", hair: "#2a201a", hairStyle: "short", glove: true, belt: "#0d0d0d" };
export const ELS: Look = { skin: "#e3b896", shirt: "#8a98a6", pants: "#cbc2ad", shoes: "#e9e5dc", sole: "#d9d4c8", cap: "#ebe7dd", hair: "#c9a978", hairStyle: "short", glove: true, belt: "#6d655a" };
export const JIMENEZ: Look = { skin: "#d9a57f", shirt: "#8d9a83", pants: "#5d6266", shoes: "#3a3634", cap: null, hair: "#3a2a20", hairStyle: "ponytail", glove: true, belt: "#2e2a26" };
