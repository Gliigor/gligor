// Display-referred finishing grade: gentle S-curve, warm highlights / cool-green shadows, saturation trim and a soft
// vignette. Runs after tone mapping, so values are 0..1.
import { Effect, BlendFunction } from "postprocessing";
import { Uniform } from "three";

const frag = /* glsl */ `
uniform float vig;
uniform float sat;
vec3 enc(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 dec(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = enc(inputColor.rgb);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);            // soft S-curve
  float y = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = vec3(y) + sat * (c - vec3(y));
  c += (1.0 - smoothstep(0.0, 0.5, y)) * vec3(-0.008, 0.004, 0.012);   // shadows: slightly cool
  c += smoothstep(0.55, 1.0, y) * vec3(0.012, 0.006, -0.012);          // highlights: warm
  vec2 p = (uv - 0.5) * vec2(0.80, 1.0);
  c *= 1.0 - vig * smoothstep(0.32, 0.78, length(p));
  outputColor = vec4(dec(c), inputColor.a);
}`;

export class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", frag, { blendFunction: BlendFunction.NORMAL, uniforms: new Map([["vig", new Uniform(0.22)], ["sat", new Uniform(1.02)]]) });
  }
}
