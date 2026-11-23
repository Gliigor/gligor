"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * Tabel met toetsenbordbediening: ↑/↓ (of j/k) kiest een rij, Enter opent hem.
 * Rijen geven hun link mee via data-href.
 */
export function KeyTable({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rows = () => Array.from(el.querySelectorAll<HTMLTableRowElement>("tbody tr[data-href]"));
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,button,a") && target.tagName !== "TR") return;
      const list = rows();
      if (list.length === 0) return;
      const current = list.findIndex((r) => r.dataset.active === "true");
      const set = (i: number) => {
        list.forEach((r) => (r.dataset.active = "false"));
        const row = list[Math.max(0, Math.min(list.length - 1, i))];
        row.dataset.active = "true";
        row.focus();
        row.scrollIntoView({ block: "nearest" });
      };
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        set(current + 1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        set(current <= 0 ? 0 : current - 1);
      } else if (e.key === "Enter" && current >= 0) {
        e.preventDefault();
        router.push(list[current].dataset.href!);
      }
    };
    el.addEventListener("keydown", onKey);
    const onClick = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-href]");
      if (!row || (e.target as HTMLElement).closest("a,button,input,select,form")) return;
      router.push(row.dataset.href!);
    };
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("click", onClick);
    };
  }, [router]);

  return (
    <div ref={ref} className="tile overflow-x-auto" tabIndex={0} aria-label={`${label} (pijltjestoetsen en Enter)`}>
      {children}
    </div>
  );
}
