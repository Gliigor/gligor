// Small, deterministic animation helpers. Everything in the video is a pure function of time (seconds),
// so any frame can be rendered on its own (Remotion renders frames out of order, in parallel tabs).
import * as THREE from "three";

export const FPS = 30;
export const DURATION = 50;
export const TOTAL_FRAMES = FPS * DURATION; // 1500

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const unlerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (x: number) => { const u = clamp(x); return u * u * (3 - 2 * u); };
export const smoother = (x: number) => { const u = clamp(x); return u * u * u * (u * (u * 6 - 15) + 10); };
export const easeOut = (x: number, p = 3) => 1 - (1 - clamp(x)) ** p;
export const easeIn = (x: number, p = 2) => clamp(x) ** p;
export const easeInOut = (x: number, p = 3) => { const u = clamp(x); return u < 0.5 ? 0.5 * (2 * u) ** p : 1 - 0.5 * (2 - 2 * u) ** p; };
/** overshoot ("back") ease for pop-ins */
export const backOut = (x: number, s = 1.7) => { const u = clamp(x) - 1; return 1 + u * u * ((s + 1) * u + s); };
/** damped spring settle 0 -> 1 */
export const spring = (x: number, freq = 2.2, damp = 5) => { if (x <= 0) return 0; return 1 - Math.exp(-damp * x) * Math.cos(freq * Math.PI * 2 * x); };
/** progress of a window [a, b] in seconds, smoothed */
export const win = (t: number, a: number, b: number, ease: (x: number) => number = smoother) => ease(unlerp(a, b, t));
/** 0 -> 1 -> 0 envelope: rise over [a, a + r], hold, fall over [b - r, b] */
export const env = (t: number, a: number, b: number, r = 0.3) => Math.min(smooth((t - a) / r), smooth((b - t) / r));

export type V3 = [number, number, number];
export const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
export const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Catmull-Rom through points, u in 0..1 over the whole path (uniform per segment) */
export const catmull = (pts: V3[], u: number): V3 => {
  const n = pts.length - 1;
  const x = clamp(u) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const t = x - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  const out: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const a = p1[k], b = p2[k];
    const m0 = (p2[k] - p0[k]) * 0.5, m1 = (p3[k] - p1[k]) * 0.5;
    const t2 = t * t, t3 = t2 * t;
    out[k] = (2 * t3 - 3 * t2 + 1) * a + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * b + (t3 - t2) * m1;
  }
  return out;
};

/** linear ramp with eased ends (constant speed in the middle) */
export const smoothRamp = (u: number, e: number) => {
  const x = clamp(u);
  const v = 1 / (1 - e);
  if (x < e) return (v * x * x) / (2 * e);
  if (x > 1 - e) return 1 - (v * (1 - x) * (1 - x)) / (2 * e);
  return v * (x - e / 2);
};

/** deterministic hash noise */
export const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** smooth 1D value noise in -1..1 */
export const noise1 = (x: number, seed = 0) => {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1;
};

/** seeded PRNG for scene layout */
export const rng = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
