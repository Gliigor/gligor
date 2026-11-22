/**
 * Stuurt de zelflopende demo aan. Elke scène is een async functie die stap
 * voor stap elementen laat verschijnen. Wisselen van scène (klik, of de demo
 * scrolt uit beeld) annuleert de lopende scène netjes.
 */

class Cancelled extends Error {}

type Scene = (ctx: Ctx) => Promise<void>;

interface Ctx {
  panel: HTMLElement;
  stage: HTMLElement;
  wait: (ms: number) => Promise<void>;
  type: (el: HTMLElement, ms: number) => Promise<void>;
}

const SCENE_ORDER = ["email", "pdf", "offerte"] as const;
const SCENE_LENGTH: Record<string, number> = { email: 12500, pdf: 11000, offerte: 11500 };

export function initDemo() {
  const root = document.querySelector<HTMLElement>("[data-demo]");
  if (!root) return;
  const stage = root.querySelector<HTMLElement>("[data-stage]")!;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-tab]"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-panel]"));
  const badge = root.querySelector<HTMLElement>("#demo-badge")!;
  const badgeText = badge.querySelector<HTMLElement>("[data-badge-text]")!;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = 0;
  let runId = 0;
  let autoplay = true;
  let inView = false;
  let progressAnim: Animation | null = null;

  // ---------- Tabs (ook zonder animatie bruikbaar) ----------
  function select(index: number, focus = false) {
    current = (index + tabs.length) % tabs.length;
    const id = SCENE_ORDER[current];
    tabs.forEach((t, i) => {
      const on = i === current;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === id;
      p.classList.toggle("is-active", on);
      p.toggleAttribute("inert", !on);
      p.setAttribute("aria-hidden", String(!on));
    });
    if (focus) tabs[current].focus();
    swapBadge(tabs[current].dataset.badge ?? "");
  }

  function swapBadge(text: string) {
    if (badgeText.textContent === text) return;
    if (reduced) {
      badgeText.textContent = text;
      return;
    }
    badge.classList.add("is-swapping");
    window.setTimeout(() => {
      badgeText.textContent = text;
      badge.classList.remove("is-swapping");
    }, 250);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      autoplay = false; // na een klik blijft de gekozen scène staan
      select(i);
      play();
    });
    tab.addEventListener("keydown", (e) => {
      const map: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
      if (e.key in map) {
        e.preventDefault();
        autoplay = false;
        select(i + map[e.key], true);
        play();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        autoplay = false;
        select(e.key === "Home" ? 0 : tabs.length - 1, true);
        play();
      }
    });
  });

  select(0);

  // Bij voorkeur voor minder beweging: alles statisch en volledig zichtbaar.
  if (reduced) return;

  root.classList.add("is-animated");

  // ---------- Hulpjes ----------
  const makeCtx = (id: number, panel: HTMLElement): Ctx => {
    const alive = () => {
      if (id !== runId) throw new Cancelled();
    };
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        window.setTimeout(() => (id === runId ? resolve() : reject(new Cancelled())), ms);
      });
    const type = (el: HTMLElement, ms: number) =>
      new Promise<void>((resolve, reject) => {
        const text = el.dataset.text ?? "";
        const start = performance.now();
        el.textContent = "";
        el.classList.add("caret");
        const tick = (now: number) => {
          if (id !== runId) {
            el.classList.remove("caret");
            return reject(new Cancelled());
          }
          const t = Math.min(1, (now - start) / ms);
          el.textContent = text.slice(0, Math.round(text.length * t));
          if (t < 1) requestAnimationFrame(tick);
          else {
            el.classList.remove("caret");
            resolve();
          }
        };
        requestAnimationFrame(tick);
      });
    alive();
    return { panel, stage, wait, type };
  };

  const on = (el: Element | null | undefined) => el?.classList.add("is-on");
  const q = <T extends Element = HTMLElement>(panel: HTMLElement, sel: string) => panel.querySelector<T>(sel);
  const qa = <T extends Element = HTMLElement>(panel: HTMLElement, sel: string) =>
    Array.from(panel.querySelectorAll<T>(sel));

  function reset(panel: HTMLElement) {
    panel.querySelectorAll(".is-on, .is-hot").forEach((el) => el.classList.remove("is-on", "is-hot"));
    panel.querySelectorAll<HTMLElement>(".d-type").forEach((el) => {
      el.textContent = "";
      el.classList.remove("caret");
    });
    stage.querySelectorAll(".fly-chip").forEach((el) => el.remove());
  }

  // Laat een waarde van de PDF naar de juiste cel in de spreadsheet vliegen.
  function fly(src: HTMLElement, dst: HTMLElement, duration: number) {
    const s = src.getBoundingClientRect();
    const d = dst.getBoundingClientRect();
    const base = stage.getBoundingClientRect();
    const chip = document.createElement("span");
    chip.className = "fly-chip";
    chip.textContent = src.textContent ?? "";
    chip.style.left = `${s.left - base.left}px`;
    chip.style.top = `${s.top - base.top}px`;
    stage.appendChild(chip);
    const dx = d.left - s.left;
    const dy = d.top - s.top;
    const anim = chip.animate(
      [
        { transform: "translate(0,0) scale(1)", offset: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.08)`, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, offset: 1 },
      ],
      { duration, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "forwards" },
    );
    return anim.finished.then(() => chip.remove()).catch(() => chip.remove());
  }

  // ---------- Scènes ----------
  const scenes: Record<string, Scene> = {
    async email({ panel, wait, type }) {
      on(q(panel, '[data-step="in"]'));
      await wait(1100);
      on(q(panel, '[data-step="out"]'));
      await wait(300);
      const thinking = q(panel, ".d-thinking");
      on(thinking);
      await wait(1300);
      thinking?.classList.remove("is-on");
      await type(q(panel, ".d-type")!, 3600);
      await wait(250);
      on(q(panel, '[data-step="actions"]'));
    },

    async pdf({ panel, wait }) {
      on(q(panel, '[data-step="doc"]'));
      await wait(700);
      on(q(panel, '[data-step="sheet"]'));
      await wait(900);
      const flights: Promise<void>[] = [];
      for (const src of qa(panel, "[data-src]")) {
        const dst = q(panel, `[data-dst="${src.dataset.src}"]`);
        // Op smalle schermen zijn sommige kolommen verborgen: die slaan we over.
        if (!dst || dst.getClientRects().length === 0) continue;
        src.classList.add("is-hot");
        await wait(250);
        flights.push(
          fly(src, dst, 850).then(() => {
            on(dst);
            src.classList.remove("is-hot");
          }),
        );
        await wait(450);
      }
      await Promise.all(flights);
      await wait(150);
      q(panel, ".d-newrow")?.classList.add("is-hot");
      on(q(panel, '[data-step="done"]'));
    },

    async offerte({ panel, wait, type }) {
      on(q(panel, '[data-step="notes"]'));
      await wait(400);
      for (const note of qa(panel, ".d-note")) {
        on(note);
        await wait(280);
      }
      await wait(500);
      on(q(panel, '[data-step="quote"]'));
      await wait(400);
      await type(q(panel, ".d-type")!, 2600);
      for (const line of qa(panel, ".d-line")) {
        on(line);
        await wait(380);
      }
    },
  };

  async function play() {
    const id = ++runId;
    const sceneId = SCENE_ORDER[current];
    const panel = panels.find((p) => p.dataset.panel === sceneId)!;
    reset(panel);

    progressAnim?.cancel();
    const bar = tabs[current].querySelector<HTMLElement>(".demo-progress");
    if (bar && autoplay) {
      progressAnim = bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        duration: SCENE_LENGTH[sceneId],
        easing: "linear",
        fill: "forwards",
      });
    }

    try {
      const ctx = makeCtx(id, panel);
      const started = performance.now();
      await scenes[sceneId](ctx);
      if (!autoplay) return;
      const rest = SCENE_LENGTH[sceneId] - (performance.now() - started);
      await ctx.wait(Math.max(2500, rest));
      progressAnim?.cancel();
      select(current + 1);
      play();
    } catch (err) {
      if (!(err instanceof Cancelled)) throw err;
    }
  }

  function stop() {
    runId++;
    progressAnim?.pause();
  }

  // Alleen afspelen als de demo in beeld is en het tabblad zichtbaar is.
  const io = new IntersectionObserver(
    ([entry]) => {
      const was = inView;
      inView = entry.isIntersecting;
      if (inView && !was && !document.hidden) play();
      else if (!inView && was) stop();
    },
    { threshold: 0.35 },
  );
  io.observe(root);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (inView) play();
  });
}
