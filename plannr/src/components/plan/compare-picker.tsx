"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { GitCompare } from "@/components/ui/icons";
import { MAX_COMPARE } from "@/lib/scenarios";

export interface PickablePlan {
  id: string;
  title: string;
  isScenario: boolean;
  archived: boolean;
}

/** "Vergelijken": first choose which plans (2 to MAX_COMPARE), then open the compare page. */
export function ComparePicker({
  clientId,
  plans,
  preselect = [],
  className,
}: {
  clientId: string;
  plans: PickablePlan[];
  preselect?: string[];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>(preselect);
  const [showArchived, setShowArchived] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const active = plans.filter((p) => !p.archived);
  const archived = plans.filter((p) => p.archived);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const full = chosen.length >= MAX_COMPARE;

  const row = (p: PickablePlan) => {
    const checked = chosen.includes(p.id);
    return (
      <label
        key={p.id}
        className={cn(
          "flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-ink-800 hover:bg-ink-50",
          !checked && full && "cursor-not-allowed opacity-50",
        )}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-gold-500"
          checked={checked}
          disabled={!checked && full}
          onChange={() => toggle(p.id)}
        />
        <span className="min-w-0 flex-1 truncate">{p.title}</span>
        {p.isScenario ? <span className="text-xs text-ink-400">scenario</span> : null}
      </label>
    );
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-800 hover:text-ink-900"
      >
        <GitCompare className="h-3.5 w-3.5" /> Vergelijken
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Plannen kiezen om te vergelijken"
          className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-sm border border-ink-200 bg-white shadow-lg"
        >
          <div className="border-b border-ink-100 px-3 py-2.5">
            <div className="text-sm font-semibold text-ink-900">Welke plannen wilt u vergelijken?</div>
            <div className="text-xs text-ink-500">Kies er 2 of {MAX_COMPARE}.</div>
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {active.map(row)}
            {archived.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowArchived((x) => !x)}
                  className="w-full px-3 py-2 text-left text-xs font-semibold text-ink-500 hover:text-ink-900"
                >
                  {showArchived ? "Verberg" : "Toon"} gearchiveerde plannen ({archived.length})
                </button>
                {/* A chosen archived plan stays visible, so it can be unticked. */}
                {(showArchived ? archived : archived.filter((p) => chosen.includes(p.id))).map(row)}
              </>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-ink-100 px-3 py-2.5">
            <span className="text-xs text-ink-500">{chosen.length} gekozen</span>
            <button
              type="button"
              disabled={chosen.length < 2}
              onClick={() => router.push(`/clienten/${clientId}/vergelijken?plannen=${chosen.join(",")}`)}
              className="h-8 rounded-sm bg-night px-3 text-[13px] font-semibold text-white hover:bg-ink-800 disabled:opacity-40"
            >
              Vergelijk
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
