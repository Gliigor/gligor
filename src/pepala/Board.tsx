// The Pepala board: a pond with six pits a side and a frog at each end.
// Every move is replayed step by step from the move record in the game state,
// so both players watch the same eggs travel.
import { CSSProperties, useEffect, useRef, useState } from "react";
import { FrogHead } from "@/pepudo/Die";
import { Anim, CAPTURE_MS, GameState, PICK_MS, STORE, animMs, isOwnPit, stepMs } from "./engine";

// ---------------------------------------------------------------- eggs

/** One frog egg: a clear jelly ball with a dark embryo inside. */
export const Egg = ({ size = 14, style }: { size?: number; style?: CSSProperties }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} style={style} aria-hidden>
    <circle cx="10" cy="10" r="9.2" fill="rgba(196,236,200,0.5)" stroke="rgba(228,255,232,0.9)" strokeWidth="1" />
    <circle cx="10" cy="10" r="6.6" fill="rgba(170,220,160,0.35)" />
    <circle cx="10.6" cy="10.8" r="3.8" fill="#1d241c" />
    <circle cx="9.4" cy="9.6" r="1.1" fill="#4b5a47" />
    <ellipse cx="6.6" cy="6.2" rx="2.3" ry="1.5" fill="rgba(255,255,255,0.75)" transform="rotate(-30 6.6 6.2)" />
  </svg>
);

/** Eggs scattered in a pit; positions only depend on the egg's number, so adding one doesn't reshuffle the rest. */
const EggPile = ({ n, cap, seed, size }: { n: number; cap: number; seed: number; size: number }) => (
  <>
    {Array.from({ length: Math.min(n, cap) }, (_, i) => {
      const r = Math.sqrt((i + 0.5) / cap);
      const a = i * 2.39996 + seed;
      return (
        <Egg
          key={i}
          size={size}
          style={{
            position: "absolute",
            left: `calc(${50 + r * Math.cos(a) * 38}% - ${size / 2}px)`,
            top: `calc(${50 + r * Math.sin(a) * 30}% - ${size / 2}px)`,
          }}
        />
      );
    })}
  </>
);

// ---------------------------------------------------------------- replay

interface Frame {
  counts: number[];
  /** The scoop of eggs being carried, and the hole it's over. */
  hand: { hole: number; n: number } | null;
  /** Holes being gulped by a frog. */
  gulp: number[];
  /** Store that just got an egg or a gulp. */
  splash: number | null;
  step: number;
}

function frameAt(a: Anim, t: number, final: number[]): Frame {
  const n = a.path.length;
  const step = stepMs(n);
  const counts = [...a.before];
  counts[a.from] = 0;
  if (t < PICK_MS) return { counts, hand: { hole: a.from, n }, gulp: [], splash: null, step };

  const k = Math.min(n, Math.floor((t - PICK_MS) / step)); // eggs dropped so far
  for (let i = 0; i < k; i++) counts[a.path[i]]++;
  const lastDrop = k > 0 ? a.path[k - 1] : null;
  const sinceDrop = t - PICK_MS - k * step;
  let splash = lastDrop !== null && STORE.includes(lastDrop) && sinceDrop < step * 0.9 ? lastDrop : null;
  if (k < n) return { counts, hand: { hole: a.path[k], n: n - k }, gulp: [], splash, step };

  let tc = t - PICK_MS - n * step;
  let gulp: number[] = [];
  if (a.capture) {
    gulp = [a.capture.pit, a.capture.opposite];
    if (tc > CAPTURE_MS * 0.55) {
      counts[a.capture.pit] = 0;
      counts[a.capture.opposite] = 0;
      counts[STORE[a.seat]] += a.capture.eggs;
      splash = STORE[a.seat];
      gulp = [];
    }
    tc -= CAPTURE_MS;
  }
  if (a.sweep && tc > 0) return { counts: final, hand: null, gulp: [], splash: null, step };
  return { counts, hand: null, gulp, splash, step };
}

/** Plays back the newest move. Returns null when nothing is playing. */
function useReplay(v: GameState): Frame | null {
  const seen = useRef(v.anim?.seq ?? 0); // don't replay a move made before we opened the page
  const [active, setActive] = useState<Anim | null>(null);
  const started = useRef(0);
  const [t, setT] = useState(0);

  useEffect(() => {
    const a = v.anim;
    if (!a || a.seq <= seen.current) return;
    seen.current = a.seq;
    started.current = performance.now();
    setT(0);
    setActive(a);
  }, [v.anim]);

  useEffect(() => {
    if (!active) return;
    const total = animMs(active);
    const id = window.setInterval(() => {
      const now = performance.now() - started.current;
      if (now >= total) setActive(null);
      else setT(now);
    }, 30);
    return () => window.clearInterval(id);
  }, [active]);

  return active ? frameAt(active, t, v.pits) : null;
}

// ---------------------------------------------------------------- layout

/** Where a hole sits, in % of the board, seen from `seat`: your pits on the right running down to your frog at the bottom. */
function spot(hole: number, seat: number): { x: number; y: number } {
  const rel = (hole - seat * 7 + 14) % 14;
  const rowY = (r: number) => 20.5 + r * 11.8;
  if (rel < 6) return { x: 73, y: rowY(rel) };
  if (rel === 6) return { x: 57, y: 92.3 };
  if (rel < 13) return { x: 27, y: rowY(12 - rel) };
  return { x: 43, y: 7.7 };
}

const OTHER_FROG: CSSProperties = { filter: "hue-rotate(165deg) saturate(1.2)" };

interface BoardProps {
  v: GameState;
  /** Seat at the bottom of the screen. */
  seat: number;
  /** Seat allowed to tap pits right now, if any. */
  canPlay: boolean;
  onSow: (pit: number) => void;
  onBusy: (busy: boolean) => void;
}

export const Board = ({ v, seat, canPlay, onSow, onBusy }: BoardProps) => {
  const f = useReplay(v);
  const busy = !!f;
  useEffect(() => onBusy(busy), [busy, onBusy]);
  const counts = f?.counts ?? v.pits;
  const last = !busy ? v.anim?.from : undefined;

  const pit = (hole: number) => {
    const { x, y } = spot(hole, seat);
    const mine = isOwnPit(seat, hole);
    const playable = canPlay && !busy && mine && counts[hole] > 0;
    const gulping = f?.gulp.includes(hole);
    const n = counts[hole];
    return (
      <button
        key={hole}
        type="button"
        disabled={!playable}
        onClick={() => onSow(hole)}
        aria-label={`${mine ? "Your" : "Their"} pit with ${n} eggs`}
        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] transition-all duration-200 ${
          playable ? "cursor-pointer ring-2 ring-[#b7f27a]/70 hover:ring-[#ffd54a] active:scale-95" : "cursor-default"
        } ${gulping ? "animate-pulse ring-[3px] ring-[#ffd54a]" : ""} ${last === hole ? "ring-1 ring-white/40" : ""}`}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          width: "35%",
          height: "9.6%",
          background: "radial-gradient(ellipse at 50% 35%, #0b2c26 0%, #123d33 60%, #1c5244 100%)",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <EggPile n={n} cap={16} seed={hole * 1.7} size={17} />
        <span
          className={`absolute -top-1.5 rounded-full px-1.5 text-[11px] font-bold leading-4 ${
            mine ? "-right-1 bg-[#b7f27a] text-[#0d2b1b]" : "-left-1 bg-[#c9b3ff] text-[#24124d]"
          }`}
        >
          {n}
        </span>
      </button>
    );
  };

  const store = (side: number) => {
    const hole = STORE[side];
    const { x, y } = spot(hole, seat);
    const mine = side === seat;
    const splash = f?.splash === hole;
    const frogX = mine ? 12.5 : 87.5;
    return (
      <div key={hole}>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%] transition-all"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: "64%",
            height: "11.5%",
            background: "radial-gradient(ellipse at 50% 35%, #0b2c26 0%, #123d33 60%, #1c5244 100%)",
            boxShadow: splash
              ? "inset 0 4px 10px rgba(0,0,0,0.6), 0 0 18px rgba(183,242,122,0.55)"
              : "inset 0 4px 10px rgba(0,0,0,0.6)",
          }}
        >
          <EggPile n={counts[hole]} cap={34} seed={side * 3.1} size={15} />
          <span
            className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-black/55 px-2 text-xl font-black ${
              mine ? "right-2 text-[#b7f27a]" : "left-2 text-[#c9b3ff]"
            }`}
          >
            {counts[hole]}
          </span>
        </div>
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-200"
          style={{
            left: `${frogX}%`,
            top: `${y}%`,
            transform: `translate(-50%, -50%) scale(${splash ? 1.22 : 1}) ${mine ? "" : "scaleX(-1)"}`,
          }}
        >
          {/* the other player's frog is a different colour */}
          <span className="block" style={mine ? undefined : OTHER_FROG}>
            <FrogHead size={62} className="drop-shadow-[0_3px_2px_rgba(0,0,0,0.5)]" />
          </span>
          {splash && (
            <span
              className="absolute -top-3 left-1/2 -translate-x-1/2 animate-in fade-in zoom-in-50 rounded-full bg-[#ffd54a] px-1.5 text-[10px] font-black text-[#3a2a00]"
              style={mine ? undefined : { transform: "translateX(-50%) scaleX(-1)" }}
            >
              GULP!
            </span>
          )}
        </div>
      </div>
    );
  };

  const hand = f?.hand;
  const handAt = hand ? spot(hand.hole, seat) : null;

  return (
    <div
      className="relative w-full select-none overflow-hidden rounded-[28px] border-4 border-[#6b4a2b]"
      style={{
        aspectRatio: "1 / 1.55",
        background:
          "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08), transparent 50%), linear-gradient(160deg, #2f6b4f 0%, #24563f 50%, #1b4231 100%)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 0 40px rgba(0,0,0,0.35)",
      }}
    >
      {Array.from({ length: 14 }, (_, h) => (STORE.includes(h) ? null : pit(h)))}
      {store(1 - seat)}
      {store(seat)}

      {/* the scoop of eggs travelling round the board */}
      {hand && handAt && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[95%]"
          style={{
            left: `${handAt.x}%`,
            top: `${handAt.y}%`,
            transition: `left ${f!.step * 0.7}ms ease-in-out, top ${f!.step * 0.7}ms ease-in-out`,
          }}
        >
          <div className="relative flex items-center justify-center rounded-full border border-[#ffd54a]/80 bg-black/45 px-1.5 py-1 shadow-lg">
            {Array.from({ length: Math.min(hand.n, 4) }, (_, i) => (
              <Egg key={i} size={17} style={{ marginLeft: i ? -7 : 0 }} />
            ))}
            <span className="ml-1 text-xs font-black text-[#ffd54a]">{hand.n}</span>
          </div>
        </div>
      )}
    </div>
  );
};
