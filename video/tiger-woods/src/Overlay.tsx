// Typography layer (DOM, always pin-sharp): titles, the step counter, the end line and the Dutch subtitles.
// Safe zone: nothing below y = 1600 (bottom 320 px) and nothing right of x = 920 (right 160 px).
import React from "react";
import { AbsoluteFill } from "remotion";
import { C, SUBS, stepCount, stepS } from "./lib/cues";
import { clamp, smooth, easeOut, backOut, unlerp } from "./lib/anim";
import { PAL } from "./world/look";

const TITLE = "'Barlow Condensed', sans-serif";
const UI = "'Inter', sans-serif";
const SAFE_L = 60, SAFE_R = 920; // usable horizontal band

/** in/out envelope for an overlay element (fade + small rise) */
const io = (t: number, a: number, b: number, rin = 0.35, rout = 0.3) => {
  const i = easeOut(unlerp(a, a + rin, t), 3), o = 1 - smooth(unlerp(b - rout, b, t));
  return Math.min(i, o);
};

const Card: React.FC<{ t: number; a: number; b: number; top: number; children: React.ReactNode; width?: number }> = ({ t, a, b, top, children, width }) => {
  const k = io(t, a, b);
  if (k <= 0) return null;
  return (
    <div style={{ position: "absolute", left: SAFE_L, width: SAFE_R - SAFE_L, top, display: "flex", justifyContent: "center", opacity: k, transform: `translateY(${(1 - k) * 26}px)` }}>
      <div style={{ background: "rgba(251,248,240,0.94)", borderRadius: 28, padding: "22px 40px 24px", boxShadow: "0 10px 34px rgba(20,32,24,0.18)", textAlign: "center", width, maxWidth: SAFE_R - SAFE_L }}>
        {children}
      </div>
    </div>
  );
};

/** words that rise in one after another */
const Rise: React.FC<{ t: number; a: number; words: { w: string; red?: boolean }[]; size: number; gap?: number }> = ({ t, a, words, size, gap = 0.09 }) => (
  <span style={{ fontFamily: TITLE, fontWeight: 800, fontSize: size, lineHeight: 1.0, letterSpacing: "0.01em", color: PAL.ink, display: "inline-block" }}>
    {words.map((x, i) => {
      const k = backOut(unlerp(a + i * gap, a + i * gap + 0.38, t), 1.4);
      return (
        <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", marginRight: i < words.length - 1 ? "0.22em" : 0 }}>
          <span style={{ display: "inline-block", transform: `translateY(${(1 - clamp(k, 0, 1.2)) * 105}%)`, color: x.red ? PAL.red : PAL.ink }}>{x.w}</span>
        </span>
      );
    })}
  </span>
);

const Small: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
  <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 34, letterSpacing: "0.02em", color: color ?? "rgba(31,43,34,0.72)", marginTop: 10 }}>{children}</div>
);


export const Overlay: React.FC<{ t: number; subs: boolean; titles?: boolean }> = ({ t, subs, titles = true }) => {
  const n = stepCount(t);
  // pop the number for ~0.15 s after it changes
  let since = 1;
  for (let k = 1; k <= 6; k++) if (stepCount(t - k / 30) !== n) { since = (k - 1) / 30; break; }
  const pop = n > 0 ? 1 + 0.12 * Math.max(0, 1 - since / 0.15) : 1;
  void stepS;
  const sub = SUBS.find((s) => t >= s.t0 && t < s.t1);
  return (
    <AbsoluteFill>
      {titles && (
        <>
          {/* 0-5: the hook */}
          <Card t={t} a={0.22} b={4.35} top={210}>
            <Rise t={t} a={0.22} size={112} words={[{ w: "HOE" }, { w: "GOED" }, { w: "WAS" }, { w: "TIGER?", red: true }]} />
          </Card>
          {/* 15-23: counting the 15 steps */}
          <Card t={t} a={C.stepsA - 0.25} b={C.gridA + 0.25} top={200} width={520}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 18 }}>
              <span style={{ fontFamily: TITLE, fontWeight: 800, fontSize: 150, lineHeight: 0.92, color: PAL.red, display: "inline-block", minWidth: 140, transform: `scale(${pop})`, fontVariantNumeric: "tabular-nums" }}>{n}</span>
              <span style={{ fontFamily: TITLE, fontWeight: 800, fontSize: 84, color: PAL.ink, letterSpacing: "0.02em" }}>{n === 1 ? "SLAG" : "SLAGEN"}</span>
            </div>
            <Small>1 tegel = 1 slag verschil</Small>
          </Card>
          {/* 23-30: nine wins */}
          <Card t={t} a={C.nineTitle - 0.05} b={C.slamA + 0.2} top={200}>
            <Rise t={t} a={C.nineTitle - 0.05} size={104} words={[{ w: "9", red: true }, { w: "PGA" }, { w: "TOUR-ZEGES" }]} />
            <Small>In 2000</Small>
          </Card>
          {/* 30-42: the Tiger Slam */}
          <Card t={t} a={C.slamTitle} b={C.xfadeB + 0.25} top={200}>
            <Rise t={t} a={C.slamTitle} size={124} words={[{ w: "TIGER", red: true }, { w: "SLAM" }]} />
            <Small>Vier majors op rij</Small>
            <div style={{ overflow: "hidden", height: 54 * smooth(unlerp(C.years, C.years + 0.4, t)), opacity: smooth(unlerp(C.years, C.years + 0.4, t)) }}>
              <div style={{ fontFamily: UI, fontWeight: 700, fontSize: 34, color: PAL.ink, marginTop: 12, letterSpacing: "0.01em" }}>
                juni 2000 <span style={{ color: PAL.red }}>→</span> april 2001
              </div>
            </div>
          </Card>
          {/* 42-50: the close */}
          <Card t={t} a={C.endText} b={49.6} top={210}>
            <Rise t={t} a={C.endText} size={110} gap={0.12} words={[{ w: "15", red: true }, { w: "SLAGEN" }, { w: "VOORSPRONG." }]} />
          </Card>
        </>
      )}
      {subs && sub && <Subtitle t={t} s={sub} />}
    </AbsoluteFill>
  );
};

const Subtitle: React.FC<{ t: number; s: { t0: number; t1: number; text: string } }> = ({ t, s }) => {
  const k = Math.min(easeOut(unlerp(s.t0, s.t0 + 0.12, t), 2), 1 - smooth(unlerp(s.t1 - 0.1, s.t1, t)));
  return (
    <div style={{ position: "absolute", left: SAFE_L + 20, width: SAFE_R - SAFE_L - 40, bottom: 1920 - 1560, display: "flex", justifyContent: "center", opacity: k }}>
      <div style={{ fontFamily: UI, fontWeight: 650, fontSize: 48, lineHeight: 1.24, color: "#ffffff", textAlign: "center", background: "rgba(20,30,23,0.66)", borderRadius: 20, padding: "12px 28px 14px", maxWidth: 780, textWrap: "balance" as never }}>
        {s.text}
      </div>
    </div>
  );
};
