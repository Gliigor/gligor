/**
 * Speelt de korte clips in "Herken je dit?". Elke clip is een reeks stappen:
 * op het juiste moment krijgt de clip de klasse s1, s2, …; de CSS in
 * Clips.astro doet de beweging. De roterende kop (pain-rotator.ts) bepaalt welke
 * clip speelt via het event "pain:show".
 *
 * - Buiten beeld of op een verborgen tabblad: niets speelt.
 * - prefers-reduced-motion: direct het eindbeeld, zonder beweging.
 */

type Step = [atMs: number, action: number | ((clip: HTMLElement) => void)];

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Typt de tekst uit data-type in het element, letter voor letter. */
function typeInto(el: HTMLElement | null, totalMs: number): number[] {
  if (!el) return [];
  const text = el.dataset.type ?? "";
  el.textContent = "";
  return [...text].map((_, i) =>
    window.setTimeout(() => (el.textContent = text.slice(0, i + 1)), Math.round((totalMs / text.length) * (i + 1))),
  );
}

const TIMELINES: Record<string, Step[]> = {
  // 0. Offertes (8,8 s)
  "0": [
    [0, 1],
    [1500, 2],
    [1800, 3],
    [1900, (c) => {
      const notes = [...c.querySelectorAll<HTMLElement>(".q-note")];
      notes.forEach((n, i) => window.setTimeout(() => timers.push(...typeInto(n, 420)), i * 480));
    }],
    [3400, 4],
    [3800, 5],
    [4150, 6],
    [4500, 7],
    [4950, 8],
    [5700, 9],
    [6900, 10],
  ],
  // 1. WhatsApp (10,2 s)
  "1": [
    [0, 1],
    [1500, 2],
    [2000, 3],
    [2900, 4],
    [4500, 5],
    [4800, 6],
    [5700, 7],
    [6500, 8],
    [6550, (c) => timers.push(...typeInto(c.querySelector<HTMLElement>(".w-typed"), 500))],
    [7350, 9],
    [7900, (c) => {
      const typed = c.querySelector<HTMLElement>(".w-typed");
      if (typed) typed.textContent = "";
    }],
    [7950, 10],
    [8600, 11],
  ],
  // Tekstclips (4,8 s)
  text: [
    [0, 1],
    [1500, 2],
    [2500, 3],
  ],
};
const LAST_STEP: Record<string, number> = { "0": 10, "1": 11, text: 3 };

let timers: number[] = [];

export function initClips() {
  const player = document.querySelector<HTMLElement>("[data-clips]");
  if (!player) return;
  const clips = new Map<number, HTMLElement>();
  player.querySelectorAll<HTMLElement>("[data-clip]").forEach((c) => clips.set(Number(c.dataset.clip), c));

  let current = 0;
  let visible = false;

  const stop = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  };

  const reset = (clip: HTMLElement) => {
    clip.classList.add("no-anim");
    for (let i = 1; i <= 12; i++) clip.classList.remove(`s${i}`);
    clip.querySelectorAll<HTMLElement>("[data-type]").forEach((el) => (el.textContent = ""));
    void clip.offsetHeight;
    clip.classList.remove("no-anim");
  };

  const finalFrame = (clip: HTMLElement, key: string) => {
    // Eindbeeld zonder beweging: alle stappen tegelijk, getypte tekst volledig.
    clip.classList.add("no-anim");
    for (let i = 1; i <= LAST_STEP[key]; i++) clip.classList.add(`s${i}`);
    clip.querySelectorAll<HTMLElement>(".q-note[data-type]").forEach((el) => (el.textContent = el.dataset.type ?? ""));
  };

  function play(index: number) {
    stop();
    current = index;
    clips.forEach((c, i) => {
      c.classList.toggle("is-on", i === index);
      if (i !== index) reset(c);
    });
    const clip = clips.get(index);
    if (!clip) return;
    const key = clip.classList.contains("clip-text") ? "text" : String(index);
    reset(clip);
    player!.style.setProperty("--clip-ms", `${clip.dataset.duration ?? 5000}ms`);
    player!.classList.remove("is-playing");

    if (reduced) {
      finalFrame(clip, key);
      return;
    }
    if (!visible || document.hidden) return;
    void player!.offsetHeight; // voortgangsbalk opnieuw starten
    player!.classList.add("is-playing");
    for (const [at, action] of TIMELINES[key]) {
      timers.push(
        window.setTimeout(() => {
          if (typeof action === "number") clip.classList.add(`s${action}`);
          else action(clip);
        }, at),
      );
    }
  }

  window.addEventListener("pain:show", (e) => play((e as CustomEvent<number>).detail));

  // Pas spelen als de speler in beeld is; bij terugkomen de clip opnieuw starten.
  const io = new IntersectionObserver(
    ([entry]) => {
      const was = visible;
      visible = entry.isIntersecting;
      if (visible && !was) play(current);
      if (!visible) {
        stop();
        player.classList.remove("is-playing");
      }
    },
    { threshold: 0.35 },
  );
  io.observe(player);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (visible) play(current);
  });

  play(0);
}

/** Hoe lang een clip duurt (ms), zodat de roterende kop er even lang op blijft staan. */
export function clipDuration(index: number): number | null {
  const el = document.querySelector<HTMLElement>(`[data-clips] [data-clip="${index}"]`);
  return el?.dataset.duration ? Number(el.dataset.duration) : null;
}
