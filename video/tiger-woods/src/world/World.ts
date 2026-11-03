// One three.js world, re-posed every frame as a pure function of (segment, time).
// Segments: 1 = hook + scoreboard (0-15.5 s), 2 = scale, nine wins, Tiger Slam (15.25-42.1 s), 3 = the close (41.75-50 s).
// Two crossfades overlap two segments (each in its own canvas); everything else is continuous camera movement.
import * as THREE from "three";
import { Course, skyDome, GREEN_C, HOLE, BOARD_X } from "./course";
import { Figure, idle, blend, swingPose, swingAt, BALL_LOCAL, THETA_TOP, TIGER, ELS, JIMENEZ, DIM, blinkAt, Pose, Look } from "./figure";
import { Scoreboard, Tile, WINS, STEP, TILE_H, trophy, pedestal, placard, label, setEnv } from "./props";
import { PAL, mat, blobMesh } from "./look";
import { C, stepS } from "../lib/cues";
import { V3, clamp, lerp, mix3, smooth, smoother, easeOut, easeInOut, backOut, unlerp, win, catmull, noise1, spring } from "../lib/anim";

export type Seg = 1 | 2 | 3;
export type Shot = { pos: V3; look: V3; fov: number; up?: V3; focus: V3; cInf: number; shadowR: number };

const TIGER_TEE: V3 = [-BALL_LOCAL[0], 0, -BALL_LOCAL[2]]; // so the ball sits at (0, ., 0)
const TEE_BALL: V3 = [0, BALL_LOCAL[1], 0];
const TILE_Z = -0.5;
const tileX = (k: number) => STEP * k;
const LAND: V3 = [34.4, 0.05, -1.0], STOP: V3 = [36.75, 0.05, -2.05];
const BOARD_LOOK: V3 = [BOARD_X, 3.3, 0];
const SLAM_X = [14.4, 16.9, 19.4, 22.7];
const SLAM_KINDS = ["usopen", "open", "pga", "masters"] as const;
const TIGER_SLAM: V3 = [18.55, 0, -2.3];
// grid (3 x 3) centred on the fairway, read left-to-right, top-to-bottom from the top-down camera (screen up = -z)
const GRID_C: V3 = [18.0, 0, -0.4];
const GRID_S = 2.55;
const gridPos = (n: number): V3 => [GRID_C[0] + ((n % 3) - 1) * GRID_S, 0, GRID_C[2] + (Math.floor(n / 3) - 1) * GRID_S];
// which scale tile becomes which win tile (spread along the line so they fly in from everywhere)
const WIN_FROM = [1, 3, 5, 7, 8, 9, 11, 13, 14];
// order of the flips: the U.S. Open (centre) first, then the rest in chronological order
const FLIP_ORDER = [4, 0, 1, 2, 3, 5, 6, 7, 8];

/** ball position during the hook (world) */
export const ballAt = (t: number): V3 => {
  if (t < C.impact) return TEE_BALL;
  if (t < C.land) {
    const u = (t - C.impact) / (C.land - C.impact);
    const x = lerp(TEE_BALL[0], LAND[0], 1 - (1 - u) ** 1.35);
    const s = unlerp(TEE_BALL[0], LAND[0], x);
    const y = TEE_BALL[1] + 12.5 * Math.sin(Math.PI * s ** 0.82) * (1 - 0.15 * s);
    const z = lerp(TEE_BALL[2], LAND[2], s) + 0.6 * Math.sin(Math.PI * s);
    return [x, Math.max(0.05, y), z];
  }
  // one hop, then a decelerating roll toward the hole
  const hopT = 0.32;
  if (t < C.land + hopT) {
    const u = (t - C.land) / hopT;
    const p = mix3(LAND, [35.3, 0.05, -1.35], u);
    return [p[0], 0.05 + 0.55 * 4 * u * (1 - u), p[2]];
  }
  const u = easeOut((t - C.land - hopT) / 1.1, 2.2);
  return mix3([35.3, 0.05, -1.35], STOP, u);
};

export class World {
  root = new THREE.Group();
  course = new Course();
  board = new Scoreboard();
  tiger = new Figure(TIGER, true);
  els = new Figure(ELS, true);
  jim = new Figure(JIMENEZ, true);
  crowd: Figure[] = [];
  ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), mat("#fbfbf8", { roughness: 0.4 }));
  teePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.06, 8), mat("#f3eee2"));
  trail: THREE.Mesh[] = [];
  tiles: Tile[] = [];
  masters = new Tile(0, { name: ["MASTERS"], n: 0, major: true, tag: "2001" });
  bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.16), mat(PAL.red, { roughness: 0.6 }));
  trophies: THREE.Group[] = [];
  placards: THREE.Group[] = [];
  pedestals: THREE.Group[] = [];
  podium = new THREE.Group();
  timeline = new THREE.Group();
  sun = new THREE.DirectionalLight("#fff0d6", 2.6);
  hemi = new THREE.HemisphereLight("#dfe9f2", "#5f7444", 1.05);
  private sunDir = new THREE.Vector3(-0.55, 0.78, 0.42).normalize();

  constructor(env: THREE.Texture | null) {
    if (env) setEnv(env);
    const R = this.root;
    R.add(skyDome(), this.course.root, this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.sun.shadow.radius = 3;
    this.board.root.position.set(BOARD_X, 0, 0);
    R.add(this.board.root);
    R.add(this.tiger.root, this.els.root, this.jim.root);
    // spectators behind the green (muted colours)
    const looks: Look[] = [
      { skin: "#e0b28e", shirt: "#7f8b97", pants: "#3f4650", shoes: "#2b2b2b", cap: "#d9d3c4", hair: "#6b5440", hairStyle: "short" },
      { skin: "#b98563", shirt: "#c9bba0", pants: "#55606a", shoes: "#3a3a3a", cap: null, hair: "#2c221b", hairStyle: "short" },
      { skin: "#8a5a3e", shirt: "#9aa58f", pants: "#2f3a45", shoes: "#2b2b2b", cap: "#47525e", hair: "#1c1612", hairStyle: "short" },
      { skin: "#efc6a4", shirt: "#a99a86", pants: "#6e6658", shoes: "#4a4440", cap: null, hair: "#b89466", hairStyle: "ponytail" },
      { skin: "#d6a07a", shirt: "#6e7f8c", pants: "#c2b79f", shoes: "#3b3b3b", cap: "#ece6da", hair: "#3b2d22", hairStyle: "short" },
    ];
    looks.forEach((l, i) => { const f = new Figure(l); f.root.position.set(33.2 + i * 1.35, 0, 6.2 + (i % 2) * 0.6); f.root.rotation.y = Math.PI + 0.35 - i * 0.12; this.crowd.push(f); R.add(f.root); });
    // rope line
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6), mat("#ece6d6")); p.position.set(32.4 + i * 1.5, 0.4, 5.3); p.castShadow = true; R.add(p);
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 7.5, 6), mat("#c4202c"));
    rope.rotation.z = Math.PI / 2; rope.position.set(36.15, 0.72, 5.3); R.add(rope);

    // ball, tee and trail
    this.ball.castShadow = true;
    R.add(this.ball, this.teePeg);
    for (let i = 0; i < 16; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.5 * (1 - i / 16), depthWrite: false }));
      this.trail.push(s); R.add(s);
    }
    // scale tiles -12 ... +3, plus the red bar that counts the steps
    for (let k = 0; k < 16; k++) {
      const w = WIN_FROM.indexOf(k);
      const t = new Tile(k - 12, w >= 0 ? WINS[w] : undefined);
      this.tiles.push(t); R.add(t.g);
    }
    this.bar.castShadow = true; R.add(this.bar);
    this.masters.g.rotation.x = Math.PI; R.add(this.masters.g);
    // the Tiger Slam set: placards, pedestals, trophies, podium, a 2000 | 2001 timeline
    SLAM_KINDS.forEach((k, i) => {
      const tr = trophy(k); this.trophies.push(tr); R.add(tr);
      const pl = placard(["U.S. OPEN", "THE OPEN", "PGA CHAMP.", "MASTERS"][i], i < 3 ? "2000" : "2001");
      this.placards.push(pl); R.add(pl);
      const pd = pedestal([0.95, 0.72, 0.72, 0.95][i]); this.pedestals.push(pd); R.add(pd);
    });
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.35, 40), mat(PAL.offWhite, { roughness: 0.6 }));
    pod.position.y = 0.175; pod.castShadow = true; pod.receiveShadow = true;
    const podRing = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.06, 40), mat(PAL.red)); podRing.position.y = 0.33;
    this.podium.add(pod, podRing); R.add(this.podium);
    const line = new THREE.Mesh(new THREE.BoxGeometry(SLAM_X[3] - SLAM_X[0] + 2.4, 0.04, 0.09), mat(PAL.offWhite));
    line.position.set((SLAM_X[0] + SLAM_X[3]) / 2, 0.02, 0); this.timeline.add(line);
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), mat(PAL.ink)); div.position.set((SLAM_X[2] + SLAM_X[3]) / 2, 0.25, 0); this.timeline.add(div);
    const y0 = label("2000", 2.2, 0.62, 300, PAL.offWhite); y0.rotation.x = -Math.PI / 2; y0.position.set((SLAM_X[0] + SLAM_X[2]) / 2, 0.03, 0.55); this.timeline.add(y0);
    const y1 = label("2001", 1.2, 0.62, 300, PAL.offWhite); y1.rotation.x = -Math.PI / 2; y1.position.set(SLAM_X[3], 0.03, 0.55); this.timeline.add(y1);
    this.timeline.position.z = 1.55;
    R.add(this.timeline);
    void blobMesh;
  }

  // ------------------------------------------------------------------ characters
  private poseTiger(seg: Seg, t: number) {
    const f = this.tiger;
    if (seg === 1) {
      f.root.position.set(...TIGER_TEE); f.root.rotation.y = 0;
      const sw = swingAt(t, C.impact);
      let p = swingPose(sw.theta, sw.phase, t);
      // after the finish: hold, then relax into a stance watching the ball
      if (t > 1.6) p = blend(p, { ...idle(t, 1), club: { hand: "L", dir: [0.15, -1, 0.25] }, handL: [0.25, 0.72, 0.12], lookAt: ballAt(t) }, smooth((t - 1.6) / 0.8));
      else if (t > C.impact + 0.12) p.lookAt = ballAt(t);
      f.pose(p);
      return;
    }
    if (seg === 2) {
      if (t < C.slamA) {
        // on the -12 tile: faces the camera, then turns to look down the line at the chasers
        const h = this.tileTop(0, seg, t);
        f.root.position.set(-0.05, h, -1.15);
        const turn = smoother((t - 16.4) / 0.9);
        f.root.rotation.y = lerp(0.35, Math.PI / 2, turn);
        const p: Pose = { ...idle(t, 1), club: { hand: "L", dir: [0.12, -1, 0.3] }, handL: [0.26, 0.72, 0.14] };
        if (t > 17.0) p.lookAt = [36, 1.4, -0.5];
        f.pose(p);
        return;
      }
      // Tiger Slam: rises on a podium behind the trophies
      const rise = easeInOut(unlerp(36.15, 37.15, t), 2.5);
      const py = lerp(-2.3, 0, rise);
      this.podium.position.set(TIGER_SLAM[0], py, TIGER_SLAM[2]);
      f.root.position.set(TIGER_SLAM[0], py + 0.36, TIGER_SLAM[2]); f.root.rotation.y = 0;
      const p: Pose = { ...idle(t, 1), club: null, handL: [0.24, 0.73, 0.05], handR: [-0.24, 0.73, 0.05] };
      // a small, proud nod when the four titles are his
      const nod = Math.sin(clamp((t - 38.3) / 0.6) * Math.PI) * 0.18;
      p.headPitch += nod;
      p.headYaw = 0.25 * Math.sin(clamp((t - 39.2) / 2.4) * Math.PI * 2) * 0.6;
      f.pose(p);
      return;
    }
    // seg 3: on the -12 tile, looking at the chasers; a restrained fist; then back to address and the takeaway
    const h = this.tileTop(0, seg, t);
    f.root.position.set(TIGER_TEE[0], h, TIGER_TEE[2]);
    const back = smoother((t - C.loopA) / 0.55);
    f.root.rotation.y = lerp(Math.PI / 2, 0, back);
    let p: Pose = { ...idle(t, 1, 0.2), club: { hand: "L", dir: [0.12, -1, 0.3] }, handL: [0.26, 0.72, 0.14], lookAt: [36, 1.3, -0.5] };
    // fist: right hand comes up in front of the hip and gives one short pump
    const fa = C.fist - 0.35;
    const up = smooth((t - fa) / 0.3) * (1 - smooth((t - (fa + 1.55)) / 0.4));
    const pump = Math.sin(clamp((t - (fa + 0.42)) / 0.32) * Math.PI) * 0.09;
    p.handR = mix3(p.handR, [-0.12, 0.98 - pump, 0.32], up);
    p.poleR = [-1, -0.5, 0.0];
    p.fistR = up;
    p.torsoPitch += 0.05 * up; p.headPitch += 0.08 * up - pump * 0.6;
    if (t > C.loopA) {
      p = blend(p, { ...swingPose(0, "back", t), lookAt: null }, smoother((t - C.loopA) / 0.5));
      // takeaway: reaches the top exactly at t = 50, which is frame 0 of the loop
      const tb = C.loopA + 0.5;
      if (t > tb) p = swingPose(THETA_TOP * smoother((t - tb) / (50 - tb)), "back", t);
    }
    f.pose(p);
  }

  private poseChasers(seg: Seg, t: number) {
    const ball = ballAt(t);
    const poseOne = (f: Figure, seed: number, side: number) => {
      if (seg === 1) {
        // beside the scoreboard; watch the ball come in, then look up at the board and react
        const pos: V3 = side < 0 ? [38.9, 0, -0.95] : [38.4, 0, 1.35];
        f.root.position.set(...pos);
        f.root.rotation.y = -Math.PI / 2 + side * 0.55;
        let p: Pose = { ...idle(t, seed), club: { hand: "L", dir: [0.1, -1, 0.3] }, handL: [0.26, 0.72, 0.14] };
        const boardP: V3 = [BOARD_X, 4.3 - (side < 0 ? 0.6 : 0.6), side * 0.4];
        if (t < 4.6) p.lookAt = t < C.impact + 0.6 ? [0, 1, 0] : ball;
        else p.lookAt = mix3(ball, boardP, smooth((t - 4.6) / 0.6));
        if (t > C.tigerScore) p.lookAt = mix3(boardP, [BOARD_X, 4.5, 1.2], smooth((t - C.tigerScore) / 0.4));
        // a small lean back when -12 lands
        const wow = Math.sin(clamp((t - C.tigerScore - 0.1) / 0.8) * Math.PI);
        p.torsoPitch -= 0.08 * wow; p.pelvis = [p.pelvis[0], p.pelvis[1], p.pelvis[2] - 0.03 * wow];
        // "plus three": shoulders drop, head goes down, one shakes his head, the other puts a hand on his hip
        const slump = smooth((t - C.plusThree - 0.05) / 0.45);
        if (slump > 0) {
          p.torsoPitch += 0.16 * slump; p.torsoRoll += side * 0.03 * slump;
          p.pelvis = [p.pelvis[0], p.pelvis[1] - 0.02 * slump, p.pelvis[2]];
          p.lookAt = mix3(p.lookAt!, [BOARD_X - 2, 0.3, side * 1.2], slump * 0.85);
          if (side < 0) { p.handR = mix3(p.handR, [-0.22, 0.86, 0.02], slump); p.poleR = [-1, 0, -0.3]; }
          else p.headYaw += 0.22 * Math.sin((t - C.plusThree) * 9) * slump * (1 - smooth((t - C.plusThree - 1.2) / 0.4));
        }
        f.pose(p);
        return;
      }
      // seg 2/3: on the +3 tile, facing back along the line toward Tiger
      const h = this.tileTop(15, seg, t);
      f.root.position.set(tileX(15) + (side < 0 ? -0.35 : 0.45), h, TILE_Z + side * 0.5);
      f.root.rotation.y = -Math.PI / 2 + side * 0.2;
      const p: Pose = { ...idle(t, seed), club: { hand: "L", dir: [0.1, -1, 0.3] }, handL: [0.26, 0.72, 0.14], lookAt: [0, 1.2, -1] };
      if (seg === 3 && side > 0) { // a small shrug on "vijftien slagen ruimte"
        const sh = Math.sin(clamp((t - C.fifteen - 0.2) / 0.7) * Math.PI);
        p.pelvis = [p.pelvis[0], p.pelvis[1] + 0.015 * sh, p.pelvis[2]];
        p.handR = mix3(p.handR, [-0.36, 0.86, 0.22], sh); p.poleR = [-1, -1, 0];
      }
      f.pose(p);
    };
    poseOne(this.els, 3, -1);
    poseOne(this.jim, 5, 1);
    // the crowd watches the ball land, then the board
    this.crowd.forEach((f, i) => {
      f.root.visible = seg === 1;
      if (!f.root.visible) return;
      const p = idle(t, 7 + i);
      p.lookAt = t < 4.9 ? (t < C.impact + 0.5 ? [0, 1, 0] : ball) : [BOARD_X, 4.2, 0];
      if (t > C.tigerScore) { // applause-ish: hands together in front
        const a = smooth((t - C.tigerScore - 0.2 - i * 0.07) / 0.3);
        const clap = Math.abs(Math.sin((t - C.tigerScore) * 11 + i)) * 0.05 * (1 - smooth((t - C.tigerScore - 2) / 0.5));
        p.handL = mix3(p.handL, [0.03 + clap, 1.05, 0.28], a); p.handR = mix3(p.handR, [-0.03 - clap, 1.05, 0.28], a);
        p.poleL = [1, -0.6, -0.2]; p.poleR = [-1, -0.6, -0.2];
      }
      f.pose(p);
    });
  }

  // ------------------------------------------------------------------ tiles
  /** height of a scale tile's top face in the line layout (segment 2/3); 0 = sunk below the ground */
  private tileRise(k: number, seg: Seg, t: number) {
    if (seg === 1) return 0;
    if (seg === 2) return backOut(unlerp(15.55 + k * 0.075, 15.95 + k * 0.075, t), 2.2);
    // seg 3: already up; sink at the very end so the loop starts on the plain tee
    return 1 - easeInOut(unlerp(48.95, 49.6, t), 2.4);
  }
  private tileTop(k: number, seg: Seg, t: number) { return TILE_H * this.tileRise(k, seg, t); }

  private poseTiles(seg: Seg, t: number) {
    const count = this.stepCount(seg, t);
    this.tiles.forEach((tile, k) => {
      const g = tile.g;
      g.visible = seg !== 1;
      if (!g.visible) return;
      g.rotation.set(0, -Math.PI / 2, 0); // numbers read upright looking down the line (+x)
      const rise = this.tileRise(k, seg, t);
      const line: V3 = [tileX(k), TILE_H * rise - TILE_H / 2, TILE_Z];
      g.scale.setScalar(1);
      // step highlight: the tile the count just reached bumps up
      if (seg === 2 && k >= 1 && t < C.gridA) {
        const reach = this.stepTime(k);
        const bump = Math.sin(clamp((t - reach) / 0.25) * Math.PI) * 0.12;
        line[1] += bump;
      }
      if (seg === 3) {
        const reach = C.fifteen + 0.05 + k * 0.06;
        line[1] += Math.sin(clamp((t - reach) / 0.22) * Math.PI) * 0.08;
      }
      let p = line;
      if (seg === 2 && t >= C.gridA) {
        const w = WIN_FROM.indexOf(k);
        if (w < 0) {
          // not a win tile: sink away
          const s = easeInOut(unlerp(C.gridA, C.gridA + 0.7, t), 2);
          p = [line[0], line[1] - s * 0.6, line[2]];
          g.visible = s < 1;
        } else {
          const u = easeInOut(unlerp(C.gridA + w * 0.06, C.gridA + 1.25 + w * 0.06, t), 2.6);
          const gp = gridPos(w);
          p = mix3(line, [gp[0], TILE_H / 2, gp[2]], u);
          p[1] += Math.sin(u * Math.PI) * 2.2;
          g.rotation.y = lerp(-Math.PI / 2, 0, u) + Math.sin(u * Math.PI) * 0.3;
          g.scale.setScalar(lerp(1, 1.18, u));
          // flip to the win face
          const order = FLIP_ORDER.indexOf(w);
          const tf = order === 0 ? C.oneTile : C.nineA + (order - 1) * 0.3;
          const fl = backOut(unlerp(tf, tf + 0.38, t), 1.4);
          g.rotation.x = Math.PI * fl;
          p[1] += Math.sin(clamp(unlerp(tf, tf + 0.38, t)) * Math.PI) * 0.7;
          // the Tiger Slam: the three majors of 2000 slide into a row; the others drop away
          if (t >= C.slamA) {
            const major = w >= 4 && w <= 6;
            if (!major) {
              const s = easeInOut(unlerp(C.slamA + (w % 3) * 0.05, C.slamA + 0.8, t), 2);
              p = [p[0], p[1] - s * 0.7, p[2]];
              g.visible = s < 1;
            } else {
              const u2 = easeInOut(unlerp(C.slamA + 0.1, C.slamA + 1.4, t), 2.4);
              p = mix3(p, [SLAM_X[w - 4], TILE_H / 2, 0], u2);
              p[1] += Math.sin(u2 * Math.PI) * 0.8;
              g.scale.setScalar(lerp(1.18, 1.0, u2));
              // the tiles sink when the trophies gather around Tiger
              const s = easeInOut(unlerp(C.gather + 0.2, C.gather + 0.9, t), 2);
              p[1] -= s * 0.6;
              g.visible = s < 1;
            }
          }
        }
      }
      g.position.set(...p);
    });
    // red count bar along the front edges of the tiles
    const len = count * STEP;
    this.bar.visible = len > 0.01;
    this.bar.scale.set(Math.max(0.001, len), 1, 1);
    const barH = seg === 1 ? 0 : TILE_H * this.tileRise(0, seg, t);
    this.bar.position.set(len / 2, barH + 0.03, TILE_Z + 1.12);
  }
  /** time the step count reaches tile k (seg 2) */
  stepTime(k: number) {
    let a = C.stepsA, b = C.stepsB;
    for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (15 * stepS(m) + 0.5 >= k) b = m; else a = m; }
    return b;
  }
  /** continuous step count shown by the bar (0..15) */
  stepCount(seg: Seg, t: number) {
    if (seg === 1) return 0;
    if (seg === 2) {
      if (t > C.gridA) return 15 * (1 - smooth((t - C.gridA) / 0.4));
      return 15 * stepS(t);
    }
    const grow = 15 * easeInOut(unlerp(C.fifteen + 0.05, C.fifteen + 1.0, t), 2);
    return grow * (1 - smooth((t - 48.95) / 0.45));
  }

  // ------------------------------------------------------------------ slam set
  private poseSlam(seg: Seg, t: number) {
    const on = seg === 2 && t > C.slamA - 0.1;
    this.timeline.visible = on;
    const tl = on ? backOut(unlerp(C.slamA + 1.0, C.slamA + 1.5, t), 1.6) * (1 - smooth((t - C.gather - 0.2) / 0.6)) : 0;
    this.timeline.scale.set(Math.max(0.001, tl), 1, Math.max(0.001, tl));
    this.timeline.position.x = (1 - tl) * 18.5;
    this.podium.visible = on;
    SLAM_KINDS.forEach((_, i) => {
      const tr = this.trophies[i], pl = this.placards[i], pd = this.pedestals[i];
      tr.visible = pl.visible = pd.visible = on;
      if (!on) return;
      // Masters tile: rises out of the ground at the end of the row (it is 2001)
      const tileTop = TILE_H;
      const appear = backOut(unlerp(C.trophy[i], C.trophy[i] + 0.45, t), 1.8);
      // placards in front of each tile
      const plu = backOut(unlerp(C.trophy[i] - 0.1, C.trophy[i] + 0.3, t), 1.6) * (1 - smooth((t - C.gather - 0.1) / 0.5));
      pl.position.set(SLAM_X[i], 0, 1.05); pl.scale.setScalar(Math.max(0.001, plu)); pl.visible = plu > 0.001;
      // trophy: pops up on its tile, then flies to its pedestal around Tiger
      const dest: V3 = [TIGER_SLAM[0] + [-1.95, -1.0, 1.0, 1.95][i], [0.95, 0.72, 0.72, 0.95][i], TIGER_SLAM[2] + [0.75, 1.35, 1.35, 0.75][i]];
      const g = easeInOut(unlerp(C.gather + i * 0.1, C.gather + 1.0 + i * 0.1, t), 2.4);
      const start: V3 = [SLAM_X[i], tileTop, 0];
      const p = mix3(start, dest, g);
      p[1] += Math.sin(g * Math.PI) * 1.2;
      tr.position.set(...p);
      tr.scale.setScalar(1.25 * Math.max(0.001, appear));
      tr.rotation.y = (1 - appear) * 2.5 + Math.sin(t * 0.8 + i) * 0.08 + (g > 0 && g < 1 ? g * Math.PI * 2 : 0);
      tr.visible = appear > 0.001;
      // pedestals rise from the ground just before the trophies land
      const pu = easeOut(unlerp(C.gather + 0.1 + i * 0.1, C.gather + 0.8 + i * 0.1, t), 3);
      pd.position.set(dest[0], lerp(-1.2, 0, pu), dest[2]);
      pd.visible = pu > 0.001;
    });
    // the 2001 (Masters) tile is not one of the nine 2000 wins: it rises out of the ground at the end of the row
    const m = this.masters.g;
    const mu = on ? backOut(unlerp(C.slamA + 1.0, C.slamA + 1.5, t), 1.8) : 0;
    const ms = on ? easeInOut(unlerp(C.gather + 0.2, C.gather + 0.9, t), 2) : 1;
    m.visible = on && mu > 0.001 && ms < 1;
    m.position.set(SLAM_X[3], TILE_H * mu - TILE_H / 2 - ms * 0.6, 0);
  }

  // ------------------------------------------------------------------ camera
  shot(seg: Seg, t: number): Shot {
    const ball = ballAt(t);
    // P0/L0: the opening frame and the last frame (the loop point): behind Tiger, down the line
    const P0: V3 = [-4.6, 1.6, -0.15], L0: V3 = [2.0, 0.8, -0.6];
    const BC0: V3 = [31.6, 0.78, 0.55], BC1: V3 = [32.6, 0.82, 0.5];
    if (seg === 1) {
      if (t < 5.0) {
        const keys: [number, V3][] = [[0, P0], [0.45, [-4.3, 1.9, 0.1]], [1.25, [-2.0, 6.5, 4.0]], [2.2, [5, 13.5, 9.5]], [3.0, [17, 11.5, 10]], [3.75, [27.5, 5.5, 6.5]], [4.4, [30.4, 1.6, 2.4]], [5.0, BC0]];
        const pos = pathAt(keys, t);
        const lookBall: V3 = [ball[0] + 3.0, ball[1] * 0.3, ball[2] * 0.4 - 1.2 * smooth((t - 0.8) / 1.5) * (1 - smooth((t - 3.2) / 0.6))];
        let look = mix3(L0, lookBall, smoother((t - 0.25) / 0.75));
        look = mix3(look, BOARD_LOOK, smoother((t - 3.95) / 1.05));
        const fov = lerp(42, 46, smooth((t - 0.4) / 1.2));
        const focus = t < 0.5 ? ([-0.2, 1.1, -1.0] as V3) : t < 3.9 ? ball : mix3(ball, BOARD_LOOK, smooth((t - 3.9) / 0.8));
        const cInf = lerp(7, 2.0, smooth((t - 0.3) / 0.8)) + 2.5 * smooth((t - 3.6) / 1.0);
        return { pos, look, fov, focus, cInf, shadowR: lerp(6, 26, smooth((t - 0.5) / 2)) };
      }
      // the scoreboard: a slow push, then into Tiger's -12 for the match cut
      const u = smooth((t - 5.0) / 9.75);
      let pos = mix3(BC0, BC1, u);
      let look = mix3(BOARD_LOOK, [BOARD_X, 3.38, 0.05], u);
      const cell: V3 = [BOARD_X - 0.08, 4.73, 1.21];
      const push = easeInOut(unlerp(C.pushIn, C.xfadeA + 0.3, t), 2.4);
      pos = mix3(pos, [BOARD_X - 2.6, cell[1], cell[2]], push);
      look = mix3(look, cell, push);
      return { pos, look, fov: lerp(46, 41, push), focus: look, cInf: 3.5, shadowR: 12 };
    }
    if (seg === 2) {
      const track = (lx: number) => ({ pos: [lx - 4.4, 2.5, 2.9] as V3, look: [lx + 1.4, 0.35, -0.6] as V3 });
      if (t < C.stepsA) {
        // from the -12 numeral on Tiger's tile, pull back and up to the tracking angle
        const u = easeInOut(unlerp(C.xfadeA, C.stepsA, t), 2.6);
        const tr = track(0);
        const pos = catmull([[-1.55, 2.05, -0.5], [-2.6, 2.4, 0.8], tr.pos], u);
        const look = mix3([0.15, 0.24, -0.5], tr.look, u);
        return { pos, look, fov: lerp(46, 42, u), focus: [0, 0.9, -0.9], cInf: lerp(5, 3, u), shadowR: lerp(5, 9, u) };
      }
      if (t < C.stepsB + 0.1) {
        // follow the 15 equal steps from Tiger to the chasers
        const lx = tileX(15) * stepS(t);
        const tr = track(lx);
        return { pos: tr.pos, look: tr.look, fov: 42, focus: [lx, 0.4, -0.5], cInf: 2.5, shadowR: 9 };
      }
      if (t < C.gridA) {
        // rest: fly back up behind Tiger; the whole line of 15 steps recedes toward the chasers
        const u = easeInOut(unlerp(C.stepsB + 0.1, C.rest + 0.75, t), 2.2);
        const tr = track(tileX(15));
        const creep = Math.max(0, t - C.rest - 0.75) * 0.25;
        const pos = catmull([tr.pos, [16, 9.5, 6.5], [-8.5 + creep, 8.0 - creep * 0.15, 3.2]], u);
        const look = mix3(tr.look, [19, 0, -0.6], u);
        return { pos, look, fov: 40, focus: [12, 0, -0.5], cInf: lerp(2.5, 0, u), shadowR: lerp(9, 26, u) };
      }
      if (t < C.slamA) {
        // up to (almost) top-down over the nine win tiles
        const u = easeInOut(unlerp(C.gridA, C.gridA + 1.4, t), 2.6);
        const from: V3 = [-8.5 + (C.gridA - C.rest - 0.75) * 0.25, 8.0, 3.2];
        const top: V3 = [GRID_C[0], 22.5 - (t - C.gridA) * 0.22, GRID_C[2] + 6.2];
        const pos = catmull([from, [6, 16, 7], top], u);
        const look = mix3([19, 0, -0.6], [GRID_C[0], 0, GRID_C[2] - 0.2], u);
        return { pos, look, fov: lerp(40, 34, u), focus: look, cInf: 0, shadowR: lerp(26, 16, u) };
      }
      const dolly = (lx: number) => ({ pos: [lx - 0.6, 2.9, 5.4] as V3, look: [lx, 0.75, 0] as V3 });
      if (t < C.trophy[0] - 0.25) {
        // down to the row of majors
        const u = easeInOut(unlerp(C.slamA, C.trophy[0] - 0.25, t), 2.4);
        const top: V3 = [GRID_C[0], 22.5 - (C.slamA - C.gridA) * 0.22, GRID_C[2] + 6.2];
        const d = dolly(SLAM_X[0]);
        const pos = catmull([top, [17, 8, 9], d.pos], u);
        const look = mix3([GRID_C[0], 0, GRID_C[2] - 0.2], d.look, u);
        return { pos, look, fov: lerp(34, 40, u), focus: look, cInf: lerp(0, 5, u), shadowR: lerp(16, 6, u) };
      }
      if (t < 36.2) {
        // dolly along the four majors as the trophies appear
        const u = easeInOut(unlerp(C.trophy[0] - 0.25, C.trophy[3] + 0.6, t), 1.6);
        const lx = lerp(SLAM_X[0], SLAM_X[3], u);
        const d = dolly(lx);
        return { pos: d.pos, look: d.look, fov: 40, focus: [lx, 0.8, 0.2], cInf: 5, shadowR: 6 };
      }
      // pull back to the Tiger Slam composition
      const u = easeInOut(unlerp(36.2, 37.6, t), 2.4);
      const creep = clamp((t - 37.6) / 4.2);
      const d = dolly(SLAM_X[3]);
      const to: V3 = [TIGER_SLAM[0], lerp(2.7, 2.6, creep), lerp(11.2, 10.4, creep)];
      const pos = catmull([d.pos, [21.5, 3.2, 8.6], to], u);
      const look = mix3(d.look, [TIGER_SLAM[0], 1.3, TIGER_SLAM[2] + 0.7], u);
      // leaving: a quick rise for the crossfade into the close
      const lift = easeInOut(unlerp(41.55, 42.2, t), 2);
      return { pos: [pos[0], pos[1] + lift * 3, pos[2] + lift * 1.5], look, fov: 40, focus: [TIGER_SLAM[0], 1.3, TIGER_SLAM[2] + 0.6], cInf: 3, shadowR: 8 };
    }
    // seg 3: descend behind Tiger, slow push, then glide into the opening frame
    const u = easeInOut(unlerp(41.75, 44.2, t), 2.4);
    let pos = catmull([[-12, 8, 4], [-6.5, 3.2, 1.0], [-4.9, 1.75, -0.1]], u);
    let look = mix3([10, 0.5, -0.6], [7, 0.9, -0.6], u);
    const d = smooth((t - 44.2) / 4.55);
    pos = mix3(pos, [-4.4, 1.65, -0.15], d);
    look = mix3(look, [8, 0.9, -0.6], d);
    const l = easeInOut(unlerp(C.loopA, 50, t), 2.2);
    pos = mix3(pos, P0, l); look = mix3(look, L0, l);
    return { pos, look, fov: lerp(40, 42, l), focus: [-0.2, 1.15, -1.0], cInf: lerp(4.5, 7, l), shadowR: 7 };
  }

  // ------------------------------------------------------------------ frame
  update(seg: Seg, t: number, cam: THREE.PerspectiveCamera) {
    this.course.update(t);
    this.poseTiger(seg, t);
    this.poseChasers(seg, t);
    this.poseTiles(seg, t);
    this.poseSlam(seg, t);
    // board panels flip in with the voice
    const fl = (a: number) => (seg === 1 ? backOut(unlerp(a, a + 0.35, t), 1.5) : 1);
    this.board.setFlip("name0", fl(C.tigerRow));
    this.board.setFlip("score0", fl(C.tigerScore));
    this.board.setFlip("name1", fl(C.chaseRows));
    this.board.setFlip("name2", fl(C.chaseRows + 0.22));
    this.board.setFlip("score1", fl(C.plusThree));
    this.board.setFlip("score2", fl(C.plusThree + 0.12));
    const tagP = seg === 1 ? backOut(unlerp(C.lowerTag, C.lowerTag + 0.4, t), 1.8) : 1;
    const swing = seg === 1 ? 0.25 * Math.exp(-3 * Math.max(0, t - C.lowerTag)) * Math.sin((t - C.lowerTag) * 9) : 0;
    this.board.setTag(tagP, swing);
    // ball, tee, trail
    const showTee = seg === 1 || (seg === 3 && t > 48.9);
    let bp: V3 = seg === 1 ? ballAt(t) : TEE_BALL;
    if (seg === 3) bp = [TEE_BALL[0], TEE_BALL[1] + this.tileTop(0, seg, t), TEE_BALL[2]];
    this.ball.visible = showTee;
    if (seg === 3) this.ball.scale.setScalar(Math.max(0.001, backOut(unlerp(48.95, 49.3, t), 2)));
    else this.ball.scale.setScalar(1);
    this.ball.position.set(...bp);
    this.teePeg.visible = showTee;
    this.teePeg.position.set(TEE_BALL[0], bp[1] - 0.075 + (seg === 1 ? -0 : 0), TEE_BALL[2]);
    if (seg === 1) this.teePeg.position.y = 0.025;
    this.trail.forEach((s, i) => {
      const tt = t - (i + 1) * 0.018;
      s.visible = seg === 1 && t > C.impact && tt > C.impact && t < C.land + 0.1;
      if (s.visible) { s.position.set(...ballAt(tt)); s.scale.setScalar(1 - i / 20); }
    });
    // camera
    const sh = this.shot(seg, t);
    cam.position.set(...sh.pos);
    cam.up.set(...(sh.up ?? [0, 1, 0]));
    cam.lookAt(...sh.look);
    cam.fov = sh.fov;
    cam.near = 0.1; cam.far = 1500;
    cam.updateProjectionMatrix();
    // sun: fixed direction, shadow frustum follows the subject
    const fc = new THREE.Vector3(...sh.focus);
    this.sun.position.copy(fc).addScaledVector(this.sunDir, 60);
    this.sun.target.position.copy(fc);
    const r = sh.shadowR;
    const sc = this.sun.shadow.camera;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 1; sc.far = 140;
    sc.updateProjectionMatrix();
    this.sun.target.updateMatrixWorld();
    void GREEN_C; void HOLE; void DIM; void blinkAt; void noise1; void spring; void win;
    return sh;
  }
}

/** piecewise Catmull-Rom over timed keys */
const pathAt = (keys: [number, V3][], t: number): V3 => {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const u = (t - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const p0 = keys[Math.max(0, i - 1)][1], p1 = keys[i][1], p2 = keys[i + 1][1], p3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const out: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const m0 = (p2[k] - p0[k]) * 0.5, m1 = (p3[k] - p1[k]) * 0.5;
    const u2 = u * u, u3 = u2 * u;
    out[k] = (2 * u3 - 3 * u2 + 1) * p1[k] + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p2[k] + (u3 - u2) * m1;
  }
  return out;
};
