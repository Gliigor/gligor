import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Vee, the blob.
 *
 * A living little character:
 * - eyes follow your mouse or finger, and blink now and then
 * - poke it (click / tap) and it squishes, giggles and says something
 * - hover and it blushes
 * - leave it alone for a while and it dozes off; move and it wakes up
 * - "thinking" looks up with dots, "talking" moves its mouth
 *
 * Everything is one inline SVG plus a few CSS animations in vee.css.
 */
export type AvatarState = "idle" | "thinking" | "talking";

interface Props {
  state: AvatarState;
  size?: number;
  /** Body color, picked on the "Customize Vee" screen. */
  color?: string;
  /** React to the pointer and to pokes. On by default. */
  interactive?: boolean;
}

type Mood = "normal" | "happy" | "sleepy";

const INK = "#2C2C2A";
const CHEEK = "#ED93B1";
const SLEEP_AFTER_MS = 40_000;
const POKE_LINES = ["Hehe!", "That tickles!", "Hi there!", "Boop!", "Wheee!", "Again?", "I'm awake!"];

// Eye centres and how far the pupils may wander (viewBox units).
const EYES = [
  { cx: 37, cy: 55 },
  { cx: 63, cy: 55 },
];
const MAX_LOOK = 3.2;

export default function VeeAvatar({ state, size = 96, color = "#F0997B", interactive = true }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [mood, setMood] = useState<Mood>("normal");
  const [hover, setHover] = useState(false);
  const [poke, setPoke] = useState(0);
  const [bubble, setBubble] = useState<string | null>(null);

  const lastActivity = useRef(Date.now());
  const moodTimer = useRef<number>();

  const wake = useCallback(() => {
    lastActivity.current = Date.now();
    setMood((m) => (m === "sleepy" ? "normal" : m));
  }, []);

  // Eyes follow the pointer anywhere on the page.
  useEffect(() => {
    if (!interactive) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      wake();
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = rootRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height * 0.55);
        const dist = Math.hypot(dx, dy) || 1;
        // Ease in: small movements near Vee move the eyes less.
        const reach = Math.min(1, dist / 220) * MAX_LOOK;
        setLook({ x: (dx / dist) * reach, y: (dy / dist) * reach });
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown", wake);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown", wake);
    };
  }, [interactive, wake]);

  // Random blinking, sometimes a double blink.
  useEffect(() => {
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        if (Math.random() < 0.25) {
          window.setTimeout(() => setBlink(true), 260);
          window.setTimeout(() => setBlink(false), 390);
        }
        schedule();
      }, 2200 + Math.random() * 4000);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  // Doze off when nothing happens for a while.
  useEffect(() => {
    if (!interactive) return;
    const id = window.setInterval(() => {
      if (Date.now() - lastActivity.current > SLEEP_AFTER_MS) setMood((m) => (m === "normal" ? "sleepy" : m));
    }, 2000);
    return () => window.clearInterval(id);
  }, [interactive]);

  // Any conversation activity wakes Vee up.
  useEffect(() => {
    if (state !== "idle") wake();
  }, [state, wake]);

  useEffect(() => () => window.clearTimeout(moodTimer.current), []);

  function onPoke() {
    if (!interactive) return;
    wake();
    setPoke((n) => n + 1);
    setMood("happy");
    setBubble(POKE_LINES[Math.floor(Math.random() * POKE_LINES.length)]);
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => {
      setMood("normal");
      setBubble(null);
    }, 1400);
  }

  const sleepy = mood === "sleepy" && state === "idle";
  const happy = mood === "happy";
  // Thinking looks up and to the side; otherwise follow the pointer.
  const eyeOffset = state === "thinking" ? { x: 2, y: -2.6 } : look;
  const eyesClosed = blink || sleepy;

  return (
    <div
      ref={rootRef}
      className={"relative inline-block select-none " + (interactive ? "cursor-pointer" : "")}
      style={{ width: size, height: size, touchAction: "manipulation" }}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Vee. Poke me!" : `Vee is ${state}`}
      onClick={onPoke}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPoke();
        }
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className={sleepy ? "vee-sleep" : state === "talking" ? "vee-bob" : "vee-breathe"}
        style={{ overflow: "visible" }}
      >
        {/* The key restarts the squish animation on every poke. */}
        <g key={poke} className={poke ? "vee-squish" : undefined}>
          {/* soft shadow */}
          <ellipse cx="50" cy="97" rx="26" ry="3" fill={INK} opacity="0.08" />

          {/* body: a soft drop shape, with a highlight */}
          <path
            d="M50 8 C62 22, 86 36, 86 60 C86 80, 70 94, 50 94 C30 94, 14 80, 14 60 C14 36, 38 22, 50 8 Z"
            fill={color}
          />
          <ellipse cx="34" cy="38" rx="6" ry="9" fill="white" opacity="0.28" transform="rotate(-25 34 38)" />

          {/* cheeks: brighter when hovered or happy */}
          <circle cx="27" cy="68" r="6.5" fill={CHEEK} opacity={hover || happy ? 0.95 : 0.6} className="vee-fade" />
          <circle cx="73" cy="68" r="6.5" fill={CHEEK} opacity={hover || happy ? 0.95 : 0.6} className="vee-fade" />

          {/* eyes */}
          {EYES.map(({ cx, cy }, i) =>
            happy ? (
              // happy "^ ^" eyes
              <path
                key={i}
                d={`M${cx - 5.5} ${cy + 2} Q${cx} ${cy - 5} ${cx + 5.5} ${cy + 2}`}
                stroke={INK}
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ) : eyesClosed ? (
              // closed: a gentle curve (sleepy) or a flat blink line
              <path
                key={i}
                d={sleepy ? `M${cx - 5} ${cy} Q${cx} ${cy + 4} ${cx + 5} ${cy}` : `M${cx - 5.5} ${cy} L${cx + 5.5} ${cy}`}
                stroke={INK}
                strokeWidth="2.6"
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              <g key={i}>
                <ellipse cx={cx} cy={cy} rx="7" ry="8" fill="white" />
                <g className="vee-look" style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>
                  <circle cx={cx} cy={cy + 0.5} r="4.4" fill={INK} />
                  <circle cx={cx + 1.6} cy={cy - 1.4} r="1.5" fill="white" />
                </g>
              </g>
            ),
          )}

          {/* mouth */}
          {state === "talking" ? (
            <ellipse cx="50" cy="73" rx="5.5" ry="4.5" fill={INK} className="vee-talk" />
          ) : happy ? (
            // big open grin with a tongue
            <g>
              <path d="M40 69 Q50 83 60 69 Z" fill={INK} />
              <path d="M45.5 75.5 Q50 79.5 54.5 75.5 Q50 73 45.5 75.5 Z" fill="#E8738F" />
            </g>
          ) : sleepy ? (
            <ellipse cx="50" cy="73" rx="2.5" ry="2" fill={INK} opacity="0.8" />
          ) : state === "thinking" ? (
            <path d="M44 73 Q50 71 56 73" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          ) : (
            <path
              d={hover ? "M40 69 Q50 80 60 69" : "M42 70 Q50 77 58 70"}
              stroke={INK}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          )}
        </g>
      </svg>

      {/* thinking dots, bottom right, bounce in sequence */}
      {state === "thinking" && (
        <div className="absolute -bottom-1 -right-2 flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="vee-dot block h-2 w-2 rounded-full"
              style={{ background: INK, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {/* sleeping z's */}
      {sleepy && (
        <div className="absolute -top-1 -right-1 font-extrabold text-[#2c2c2a]/50" aria-hidden>
          <span className="vee-z block text-sm">z</span>
          <span className="vee-z block text-xs" style={{ animationDelay: "0.8s" }}>
            z
          </span>
        </div>
      )}

      {/* speech bubble after a poke */}
      {bubble && (
        <div
          className="vee-pop absolute left-[80%] top-0 z-20 whitespace-nowrap rounded-2xl rounded-bl-sm bg-white px-3 py-1 text-xs font-bold shadow-md border border-[#2c2c2a]/10"
          aria-live="polite"
        >
          {bubble}
        </div>
      )}
    </div>
  );
}
