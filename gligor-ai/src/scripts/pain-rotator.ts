/**
 * Roterende kop in "Herken je dit?": elke 3 seconden het volgende pijnpunt.
 * Pauzeert bij hover/focus en buiten beeld; bij prefers-reduced-motion blijft
 * het eerste item staan (de bolletjes werken dan nog wel, zonder animatie).
 */

const INTERVAL_MS = 3000;
const ANSWER_DELAY_MS = 300;
const TYPE_MS = 750;
const LEAVE_MS = 560;

export function initPainRotator() {
  const root = document.querySelector<HTMLElement>("[data-rotator]");
  if (!root) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>("[data-rot-item]"));
  const dots = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-rot-dot]"));
  const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-pain-card]"));
  if (items.length === 0) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = 0;
  let timer = 0;
  let typeFrame = 0;
  let typeDelay = 0;
  const leaveTimers = new Map<HTMLElement, number>();
  const paused = { hover: false, focus: false, offscreen: true, hidden: document.hidden };

  function typeAnswer(item: HTMLElement) {
    const el = item.querySelector<HTMLElement>(".rot-answer");
    if (!el) return;
    const text = el.dataset.text ?? "";
    cancelAnimationFrame(typeFrame);
    clearTimeout(typeDelay);
    if (reduced) {
      el.textContent = text;
      return;
    }
    el.textContent = "";
    typeDelay = window.setTimeout(() => {
      el.classList.add("is-typing");
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / TYPE_MS);
        el.textContent = text.slice(0, Math.round(text.length * t));
        if (t < 1) typeFrame = requestAnimationFrame(tick);
        else el.classList.remove("is-typing");
      };
      typeFrame = requestAnimationFrame(tick);
    }, ANSWER_DELAY_MS);
  }

  function finishTyping() {
    // Het vorige antwoord direct afmaken, zodat het tijdens het uitfaden compleet is.
    cancelAnimationFrame(typeFrame);
    clearTimeout(typeDelay);
    items.forEach((item) => {
      const el = item.querySelector<HTMLElement>(".rot-answer");
      if (el) {
        el.textContent = el.dataset.text ?? "";
        el.classList.remove("is-typing");
      }
    });
  }

  function show(index: number) {
    const next = (index + items.length) % items.length;
    if (next === current) return;
    const prev = items[current];
    const incoming = items[next];
    finishTyping();

    // Inkomend item: eventuele lopende "terugzet" annuleren en vanaf onder laten komen.
    const pending = leaveTimers.get(incoming);
    if (pending) {
      clearTimeout(pending);
      leaveTimers.delete(incoming);
    }
    incoming.classList.add("no-anim");
    incoming.classList.remove("is-leaving");
    void incoming.offsetHeight; // reflow: start echt onderaan
    incoming.classList.remove("no-anim");

    if (reduced) {
      prev.classList.remove("is-active");
    } else {
      prev.classList.remove("is-active");
      prev.classList.add("is-leaving");
      leaveTimers.set(
        prev,
        window.setTimeout(() => {
          prev.classList.add("no-anim");
          prev.classList.remove("is-leaving");
          void prev.offsetHeight;
          prev.classList.remove("no-anim");
          leaveTimers.delete(prev);
        }, LEAVE_MS),
      );
    }

    incoming.classList.add("is-active");
    current = next;
    typeAnswer(incoming);

    dots.forEach((d, i) => {
      if (i === current) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
    cards.forEach((c, i) => c.classList.toggle("is-current", i === current));
  }

  function schedule() {
    clearTimeout(timer);
    if (reduced) return;
    if (paused.hover || paused.focus || paused.offscreen || paused.hidden) return;
    timer = window.setTimeout(() => {
      show(current + 1);
      schedule();
    }, INTERVAL_MS);
  }

  dots.forEach((dot, i) =>
    dot.addEventListener("click", () => {
      show(i);
      schedule(); // na een klik weer de volle 3 seconden voor dit item
    }),
  );

  root.addEventListener("mouseenter", () => {
    paused.hover = true;
    schedule();
  });
  root.addEventListener("mouseleave", () => {
    paused.hover = false;
    schedule();
  });
  root.addEventListener("focusin", (e) => {
    // Alleen pauzeren bij toetsenbordfocus; een muisklik op een bolletje laat de rotatie doorlopen.
    const target = e.target as HTMLElement;
    if (!target.matches(":focus-visible")) return;
    paused.focus = true;
    schedule();
  });
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget as Node | null)) {
      paused.focus = false;
      schedule();
    }
  });
  document.addEventListener("visibilitychange", () => {
    paused.hidden = document.hidden;
    schedule();
  });

  const io = new IntersectionObserver(
    ([entry]) => {
      paused.offscreen = !entry.isIntersecting;
      schedule();
    },
    { threshold: 0.5 },
  );
  io.observe(root);
}
