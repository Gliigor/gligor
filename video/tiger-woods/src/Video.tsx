// "Hoe goed was Tiger Woods?" - 50 s vertical mini-documentary. Remotion + @remotion/three.
// Each frame: decide which story segment(s) are on screen (two crossfades overlap two segments in two canvases),
// pose the world for that segment at time t, render through ink-free post (thin-lens DOF -> tone map -> grade),
// and lay the DOM typography and subtitles on top.
import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { World, Seg } from "./world/World";
import { LensBlur } from "./lensblur";
import { GradeEffect } from "./grade";
import { Overlay } from "./Overlay";
import { FPS } from "./lib/anim";
import { C } from "./lib/cues";
import { PAL } from "./world/look";

const FONTS: [string, string, string][] = [
  ["Barlow Condensed", "fonts/barlow-condensed-latin-600-normal.woff2", "600"],
  ["Barlow Condensed", "fonts/barlow-condensed-latin-700-normal.woff2", "700"],
  ["Barlow Condensed", "fonts/barlow-condensed-latin-800-normal.woff2", "800"],
  ["Inter", "fonts/inter-latin-500-normal.woff2", "500"],
  ["Inter", "fonts/inter-latin-600-normal.woff2", "600"],
  ["Inter", "fonts/inter-latin-700-normal.woff2", "700"],
  ["Inter", "fonts/inter-latin-800-normal.woff2", "800"],
];
let fontsPromise: Promise<void> | null = null;
const loadFonts = () => {
  fontsPromise ??= Promise.all(FONTS.map(async ([fam, file, weight]) => {
    const f = new FontFace(fam, `url(${staticFile(file)})`, { weight });
    await f.load();
    document.fonts.add(f);
  })).then(() => undefined);
  return fontsPromise;
};
const useFonts = () => {
  const [ok, setOk] = useState(false);
  const [h] = useState(() => delayRender("fonts"));
  useEffect(() => { loadFonts().then(() => { setOk(true); continueRender(h); }); }, [h]);
  return ok;
};

const X1 = 8 / FPS, X2 = 12 / FPS;
export const layersAt = (t: number): { seg: Seg; alpha: number }[] => {
  if (t >= C.xfadeA && t < C.xfadeA + X1) return [{ seg: 1, alpha: 1 }, { seg: 2, alpha: (t - C.xfadeA + 1 / FPS) / (X1 + 1 / FPS) }];
  if (t >= C.xfadeB && t < C.xfadeB + X2) return [{ seg: 2, alpha: 1 }, { seg: 3, alpha: (t - C.xfadeB + 1 / FPS) / (X2 + 1 / FPS) }];
  return [{ seg: t < C.xfadeA ? 1 : t < C.xfadeB ? 2 : 3, alpha: 1 }];
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ seg: Seg }> = ({ seg }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const { camera, gl, scene } = useThree();
  const env = useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const e = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return e;
  }, [gl]);
  const world = useMemo(() => new World(env), [env]);
  const fx = useMemo(() => ({
    lens: new LensBlur({ maxCoC: 22, nearScale: 1.1 }),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(),
  }), []);
  useMemo(() => { scene.fog = new THREE.Fog(PAL.horizon, 70, 320); scene.background = new THREE.Color(PAL.horizon); }, [scene]);
  const cam = camera as THREE.PerspectiveCamera;
  const sh = world.update(seg, t, cam);
  cam.getWorldDirection(fwd);
  fpt.set(...sh.focus);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = sh.cInf;
  // post chain, built by hand (postprocessing): render -> lens blur pre -> lens blur main -> tone map + grade
  const { size } = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, { multisampling: 4, frameBufferType: THREE.HalfFloatType });
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new EffectPass(camera, fx.lens.pre));
    c.addPass(new EffectPass(camera, fx.lens.main));
    c.addPass(new EffectPass(camera, fx.tone, fx.grade));
    return c;
  }, [gl, scene, camera, fx]);
  useEffect(() => () => composer.dispose(), [composer]);
  const noPost = (getInputProps() as { noPost?: boolean }).noPost;
  useFrame(() => {
    if (noPost) { gl.render(scene, camera); return; }
    composer.setSize(size.width, size.height, false);
    composer.render();
  }, 1);
  return (
    <>
      <primitive object={world.root} dispose={null} />
    </>
  );
};

const SegCanvas: React.FC<{ seg: Seg; alpha: number }> = ({ seg, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} shadows flat gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }} camera={{ fov: 40, near: 0.1, far: 1500 }}>
      <Inner seg={seg} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export type Props = { subs: boolean; audio: string | null; titles?: boolean; world?: boolean };
export const TigerShort: React.FC<Props> = ({ subs, audio, titles = true, world = true }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const ready = useFonts();
  if (!ready) return null;
  return (
    <AbsoluteFill style={{ background: world ? PAL.horizon : "transparent" }}>
      {world && layersAt(t).map((l) => <SegCanvas key={l.seg} seg={l.seg} alpha={l.alpha} />)}
      <Overlay t={t} subs={subs} titles={titles} />
      {audio && <Audio src={staticFile(audio)} />}
    </AbsoluteFill>
  );
};
