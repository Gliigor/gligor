// Adapted from mromidev/claude-animated-shorts (templates/bridge/lensblur.ts, MIT License, (c) 2026 Mr omi).
// Tap counts reduced for software (SwiftShader) rendering; film grain removed.
// Thin-lens depth of field for the reference's soft backgrounds (reports/depth.md 6.1), as two deterministic gather
// passes. CoC radius (px at 1080x1920) = cInf * |1 - focus / depth|, x nearScale in front of the focus plane,
// clamped to maxCoC. Every pixel size is multiplied in the shader by (output height / 1920), so the picture is the
// same at 540, 1080 and 1440 widths.
//   pre  : 16-tap gather over 0.29 x the CoC. It fills the gaps between the main taps, so the composite kernel is a
//          smooth disc (1024 effective taps) instead of 64 visible copies of every edge.
//   main : 64-tap Vogel disc over 0.96 x the CoC (pre + main together = a disc of sigma CoC/2), plus a 32-tap near
//          field gather that lets a blurred foreground spread over sharper pixels behind it.
// Occlusion rules (no halos, no dark rims): a sample counts only if its own CoC reaches this pixel, a farther sample
// may never spread wider than this pixel's own CoC (sharp subjects keep clean silhouettes), and the result is
// renormalised by the accepted weights. Fixed sample pattern, no per-pixel noise: no grain, no frame-to-frame flicker.
// Both passes are CONVOLUTION effects, so R3F's <EffectComposer> gives each its own EffectPass.
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const frag = /* glsl */ `
uniform float focus;      // focus distance along the view axis (m)
uniform float cInf;       // blur-disc radius (px at 1080x1920) of things at infinity; 0 = off
uniform float nearScale;  // extra blur for things in front of the focus plane
uniform float maxCoC;     // px at 1080x1920
#define GOLDEN 2.39996323

float cocAt(float d, float s) {               // signed CoC radius in output px
  float c = cInf * s * (1.0 - focus / max(d, 1e-3));
  if (c < 0.0) c *= nearScale;
  return clamp(c, -maxCoC * s, maxCoC * s);
}
float distAt(vec2 uv) { return -getViewZ(readDepth(uv)); }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (cInf < 0.25) { outputColor = inputColor; return; }
  float s = resolution.y / 1920.0;             // output px per 1080x1920 px
  float d0 = -getViewZ(depth);
  float r0 = abs(cocAt(d0, s));
  float R = r0 * SPREAD;
  vec3 acc = inputColor.rgb; float wsum = 1.0;
  if (R > 0.5) {
    for (int i = 0; i < TAPS; i++) {
      float rr = sqrt((float(i) + 0.5) / float(TAPS)) * R;
      float a = float(i) * GOLDEN + ROT;
      vec2 suv = uv + vec2(cos(a), sin(a)) * rr * texelSize;
      float ds = distAt(suv);
      float rs = abs(cocAt(ds, s)) * SPREAD;
      if (ds > d0) rs = min(rs, R);            // background never bleeds over a nearer pixel
      float w = clamp(rs - rr + 0.5, 0.0, 1.0); // does the sample's disc reach us?
      acc += texture2D(inputBuffer, suv).rgb * w; wsum += w;
    }
  }
  vec3 col = acc / wsum;
#if NEAR_TAPS > 0
  float M = maxCoC * s;
  vec3 fg = vec3(0.0); float fw = 0.0, cov = 0.0;
  for (int i = 0; i < NEAR_TAPS; i++) {
    float rr = sqrt((float(i) + 0.5) / float(NEAR_TAPS)) * M;
    if (rr <= R) continue;                      // already covered by the disc gather
    float a = float(i) * GOLDEN + 1.0;
    vec2 suv = uv + vec2(cos(a), sin(a)) * rr * texelSize;
    float ds = distAt(suv);
    if (ds >= d0 * 0.97) continue;              // only things in front of us
    float rs = abs(cocAt(ds, s));
    float w = clamp(rs - rr + 0.5, 0.0, 1.0);
    fg += texture2D(inputBuffer, suv).rgb * w; fw += w;
    cov += w * (M * M) / max(rs * rs, 1.0);
  }
  if (fw > 0.0) col = mix(col, fg / fw, clamp(cov / float(NEAR_TAPS), 0.0, 1.0));
#endif
  outputColor = vec4(col, inputColor.a);
}`;

type Stage = { taps: number; spread: number; nearTaps: number; rot: number };
const PRE: Stage = { taps: 12, spread: 0.30, nearTaps: 0, rot: 0.61 };
const MAIN: Stage = { taps: 40, spread: 0.958, nearTaps: 12, rot: 0 };

export class LensBlurEffect extends Effect {
  constructor({ maxCoC = 24, nearScale = 1.2, stage = MAIN }: { maxCoC?: number; nearScale?: number; stage?: Stage } = {}) {
    super("LensBlurEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      defines: new Map<string, string>([
        ["TAPS", String(stage.taps)], ["SPREAD", stage.spread.toFixed(4)], ["NEAR_TAPS", String(stage.nearTaps)], ["ROT", stage.rot.toFixed(4)],
      ]),
      uniforms: new Map<string, Uniform>([
        ["focus", new Uniform(10)], ["cInf", new Uniform(0)], ["nearScale", new Uniform(nearScale)], ["maxCoC", new Uniform(maxCoC)],
      ]),
    });
  }
  set focus(v: number) { this.uniforms.get("focus")!.value = v; }
  get focus() { return this.uniforms.get("focus")!.value as number; }
  set cInf(v: number) { this.uniforms.get("cInf")!.value = v; }
  get cInf() { return this.uniforms.get("cInf")!.value as number; }
}

/** The pair of passes the composer needs (pre first, then main); set focus / cInf once per frame on this object. */
export class LensBlur {
  readonly pre: LensBlurEffect;
  readonly main: LensBlurEffect;
  constructor({ maxCoC = 24, nearScale = 1.2 } = {}) {
    this.pre = new LensBlurEffect({ maxCoC, nearScale, stage: PRE });
    this.main = new LensBlurEffect({ maxCoC, nearScale, stage: MAIN });
  }
  set focus(v: number) { this.pre.focus = v; this.main.focus = v; }
  set cInf(v: number) { this.pre.cInf = v; this.main.cInf = v; }
  dispose() { this.pre.dispose(); this.main.dispose(); }
}

