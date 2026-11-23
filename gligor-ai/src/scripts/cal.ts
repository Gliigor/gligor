/**
 * Cal.com inline embed. Het script van Cal.com wordt pas geladen als de
 * bezoeker in de buurt van de agenda scrolt: dat houdt de pagina snel en
 * deelt geen gegevens met Cal.com zolang niemand de agenda bekijkt.
 */

declare global {
  interface Window {
    Cal?: CalFn;
  }
}
type CalFn = ((...args: unknown[]) => void) & { ns: Record<string, (...args: unknown[]) => void>; loaded?: boolean; q?: unknown[] };

const NAMESPACE = "kennismaking";
const TIMEOUT_MS = 12000;

function loadCalBootstrap() {
  // Officiële Cal.com-loader (verkort), zet een wachtrij klaar tot embed.js geladen is.
  /* eslint-disable */
  (function (C: any, A: string, L: string) {
    const p = function (a: any, ar: any) { a.q.push(ar); };
    const d = C.document;
    C.Cal = C.Cal || function () {
      const cal = C.Cal;
      const ar = arguments;
      if (!cal.loaded) {
        cal.ns = {};
        cal.q = cal.q || [];
        d.head.appendChild(d.createElement("script")).src = A;
        cal.loaded = true;
      }
      if (ar[0] === L) {
        const api: any = function () { p(api, arguments); };
        const namespace = ar[1];
        api.q = api.q || [];
        if (typeof namespace === "string") {
          cal.ns[namespace] = cal.ns[namespace] || api;
          p(cal.ns[namespace], ar);
          p(cal, ["initNamespace", namespace]);
        } else p(cal, ar);
        return;
      }
      p(cal, ar);
    };
  })(window, "https://app.cal.com/embed/embed.js", "init");
  /* eslint-enable */
}

export function initCal() {
  const el = document.getElementById("cal-inline");
  const status = document.getElementById("cal-status");
  if (!el || !status) return;
  const calLink = el.dataset.calLink!;
  const loading = status.querySelector<HTMLElement>("[data-cal-loading]")!;
  const failed = status.querySelector<HTMLElement>("[data-cal-failed]")!;

  let done = false;
  const showFailed = () => {
    if (done) return;
    done = true;
    loading.classList.add("hidden");
    failed.classList.remove("hidden");
    failed.classList.add("flex");
  };
  const showReady = () => {
    if (done) return;
    done = true;
    status.classList.add("hidden");
  };

  const start = () => {
    try {
      loadCalBootstrap();
      const Cal = window.Cal!;
      Cal("init", NAMESPACE, { origin: "https://app.cal.com" });
      const ns = Cal.ns[NAMESPACE];
      ns("inline", { elementOrSelector: "#cal-inline", calLink, config: { layout: "month_view" } });
      ns("ui", {
        theme: "light",
        layout: "month_view",
        hideEventTypeDetails: false,
        cssVarsPerTheme: { light: { "cal-brand": "#2563EB" } },
      });
      ns("on", { action: "linkReady", callback: showReady });
      ns("on", { action: "linkFailed", callback: showFailed });
      window.setTimeout(() => {
        // Iframe staat er wel, maar geen "ready"-signaal: toon hem toch.
        if (el.querySelector("iframe")) showReady();
        else showFailed();
      }, TIMEOUT_MS);
    } catch {
      showFailed();
    }
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        io.disconnect();
        start();
      }
    },
    { rootMargin: "800px 0px" },
  );
  io.observe(el);
}
