// Story clock. All cue times (seconds) derive from the measured voice-over (src/timeline.json, written by
// voice/build_voice.py), so picture, subtitles and sound share one source of truth.
import TL from "../timeline.json";
import { clamp, smoothRamp } from "./anim";

export type Phrase = { id: string; t0: number; t1: number; text: string };
export type Sub = { t0: number; t1: number; text: string };
export const PHRASES = TL.phrases as Phrase[];
export const SUBS = TL.subs as Sub[];
const P = (id: string) => PHRASES.find((p) => p.id === id)!;
/** time of a character offset inside a phrase (linear estimate of word timing) */
export const at = (id: string, word: string) => {
  const p = P(id);
  const i = p.text.indexOf(word);
  return p.t0 + ((p.t1 - p.t0) * Math.max(0, i)) / p.text.length;
};

export const C = {
  // 0-5 hook
  impact: 0.2,
  land: 3.75,
  // 5-15 the proof (scoreboard)
  board: 4.75,
  lowerTag: at("s04", "laagste"),
  tigerRow: P("s05").t0,
  tigerScore: at("s05", "min twaalf"),
  chaseRows: at("s06", "achtervolgers"),
  plusThree: P("s07").t0 + 0.05,
  // 15-23 the 15 steps
  pushIn: 14.75,
  xfadeA: 15.25, // board -> tile crossfade start (8 frames)
  scaleUp: P("s08").t0,
  stepsA: 17.15,
  stepsB: 21.05,
  rest: 21.45,
  // 23-30 nine wins
  gridA: 22.85,
  oneTile: at("s11", "één"),
  nineA: at("s12", "negen") - 0.1,
  nineTitle: at("s12", "negen"),
  // 30-42 Tiger Slam
  slamA: 29.9,
  slamTitle: P("s13").t0 + 0.6,
  trophy: [at("s14", "vier") + 0.15, at("s14", "opeenvolgende") + 0.55, at("s14", "majors") + 0.1, at("s14", "de belangrijkste") + 0.1],
  gather: P("s15").t0,
  years: P("s16").t0,
  // 42-50 close
  xfadeB: 41.75,
  redShirt: P("s18").t0,
  fifteen: P("s19").t0,
  endText: at("s19", "slagen"),
  fist: P("s19").t1 - 0.05,
  loopA: 48.75,
};

/** 0..1 progress of the camera along the 15 steps (seg 2); the counter, the red bar and the camera all use it */
export const stepS = (t: number) => smoothRamp(clamp((t - C.stepsA) / (C.stepsB - C.stepsA)), 0.08);
/** whole steps reached (0..15): a step counts when the camera's centre passes the middle between two tiles */
export const stepCount = (t: number) => Math.min(15, Math.floor(15 * stepS(t) + 0.5));
