/**
 * Besparingscalculator.
 *   monthly_saving  = hours_per_week × 4,33 × hourly_rate × people
 *   net_saving      = monthly_saving − 100
 *   breakeven_hours = 100 / hourly_rate   (uren per maand)
 */

const WEEKS_PER_MONTH = 4.33;

const euro = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const hoursFmt = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 1 });

export const formatEuro = (n: number) => euro.format(Math.round(n)).replace(/ /g, " ");
export const formatHours = (n: number) => `${hoursFmt.format(n)} uur`;

export function calculate(rate: number, hoursPerWeek: number, people: number, price: number) {
  const monthly = hoursPerWeek * WEEKS_PER_MONTH * rate * people;
  return {
    monthly,
    net: monthly - price,
    breakeven: rate > 0 ? price / rate : 0,
  };
}

export function initCalculator() {
  const form = document.querySelector<HTMLFormElement>("#calc");
  if (!form) return;
  form.addEventListener("submit", (e) => e.preventDefault());

  const price = Number(form.dataset.price ?? 100);
  const rateEl = form.querySelector<HTMLInputElement>("#calc-rate")!;
  const hoursEl = form.querySelector<HTMLInputElement>("#calc-hours")!;
  const peopleEl = form.querySelector<HTMLInputElement>("#calc-people")!;
  const hoursOut = form.querySelector<HTMLOutputElement>("#calc-hours-out")!;
  const out = (k: string) => form.querySelector<HTMLElement>(`[data-out="${k}"]`)!;
  const netPos = form.querySelector<HTMLElement>("[data-net-positive]")!;
  const netNeg = form.querySelector<HTMLElement>("[data-net-negative]")!;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shown: Record<string, number> = {};
  const frames: Record<string, number> = {};

  // Telt soepel van de vorige naar de nieuwe waarde.
  function countTo(key: string, target: number, fmt: (n: number) => string) {
    const el = out(key);
    const from = shown[key] ?? target;
    cancelAnimationFrame(frames[key]);
    if (reduced || from === target) {
      shown[key] = target;
      el.textContent = fmt(target);
      return;
    }
    const start = performance.now();
    const dur = 650;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      shown[key] = v;
      el.textContent = fmt(v);
      if (t < 1) frames[key] = requestAnimationFrame(step);
      else shown[key] = target;
    };
    frames[key] = requestAnimationFrame(step);
  }

  const read = (el: HTMLInputElement, min: number, max: number, fallback: number) => {
    const n = Number(String(el.value).replace(",", "."));
    if (!Number.isFinite(n) || el.value === "") return fallback;
    return Math.min(max, Math.max(min, n));
  };

  function update() {
    const rate = read(rateEl, 1, 1000, 50);
    const hours = read(hoursEl, 0, 10, 2);
    const people = Math.round(read(peopleEl, 1, 250, 1));
    const r = calculate(rate, hours, people, price);

    hoursOut.textContent = formatHours(hours);
    hoursEl.style.setProperty("--fill", `${(hours / 10) * 100}%`);
    hoursEl.setAttribute("aria-valuetext", formatHours(hours) + " per week");

    countTo("monthly", r.monthly, formatEuro);
    countTo("net", Math.max(0, r.net), formatEuro);
    countTo("rate", rate, formatEuro);
    out("breakeven").textContent = formatHours(r.breakeven);

    const positive = r.net > 0;
    netPos.classList.toggle("hidden", !positive);
    netNeg.classList.toggle("hidden", positive);
  }

  form.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = read(peopleEl, 1, 250, 1) + Number(btn.dataset.step);
      peopleEl.value = String(Math.min(250, Math.max(1, next)));
      update();
    });
  });

  [rateEl, hoursEl, peopleEl].forEach((el) => el.addEventListener("input", update));
  // Bij verlaten van een veld de getoonde waarde netjes rechtzetten.
  [rateEl, peopleEl].forEach((el) =>
    el.addEventListener("change", () => {
      if (el === rateEl) el.value = String(read(rateEl, 1, 1000, 50));
      else el.value = String(Math.round(read(peopleEl, 1, 250, 1)));
      update();
    }),
  );

  // Eerste keer tellen vanaf 0 zodra de calculator in beeld komt.
  if (reduced) {
    update();
    return;
  }
  shown.monthly = 0;
  shown.net = 0;
  out("monthly").textContent = formatEuro(0);
  out("net").textContent = formatEuro(0);
  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        io.disconnect();
        update();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(form);
}
