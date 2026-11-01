"use client";

import { useState } from "react";
import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Check } from "@/components/ui/icons";
import { LEGACY_STEPS, PHASES } from "@/lib/plan/definitions";
import type { StepStatus } from "@/lib/plan/status";

/**
 * The step plan on the left: every step grouped by phase, each one a link, so the
 * planner can jump straight to anything that needs changing. On small screens it
 * folds into one line above the step.
 */
export function StepPlan({ baseHref, steps }: { baseHref: string; steps: StepStatus[] }) {
  const segment = useSelectedLayoutSegment() ?? "documenten";
  const active = LEGACY_STEPS[segment] ?? segment;
  const [open, setOpen] = useState(false);
  const index = Math.max(0, steps.findIndex((s) => s.key === active));
  const done = steps.filter((s) => s.state === "complete").length;

  return (
    <nav aria-label="Stappen van het plan" className="lg:sticky lg:top-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-b border-ink-200 pb-3 text-left text-sm lg:hidden"
      >
        <span>
          <span className="text-ink-500">
            Stap {index + 1} van {steps.length} ·{" "}
          </span>
          <span className="font-semibold text-ink-900">{steps[index]?.label}</span>
        </span>
        <span className="text-xs font-semibold text-ink-600">{open ? "Sluiten" : "Alle stappen"}</span>
      </button>

      <div className={cn("mt-4 lg:mt-0 lg:block", open ? "block" : "hidden")}>
        <div className="mb-5 hidden lg:block">
          <div className="h-[3px] bg-ink-200">
            <div className="h-full bg-ink-900 transition-[width] duration-300" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-500">
            {done} van {steps.length} stappen gedaan
          </p>
        </div>
        <ol className="space-y-5">
          {PHASES.map((phase) => {
            const items = steps.filter((s) => s.phase === phase.key);
            if (items.length === 0) return null;
            return (
              <li key={phase.key}>
                <div className="eyebrow mb-1.5 !text-[10.5px]">{phase.label}</div>
                <ul>
                  {items.map((step) => {
                    const isActive = step.key === active;
                    return (
                      <li key={step.key}>
                        <Link
                          href={`${baseHref}/${step.key}`}
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? "step" : undefined}
                          className={cn(
                            "flex items-center justify-between gap-2 border-l-2 py-1.5 pl-3 pr-1 text-[13.5px] transition-colors",
                            isActive ? "border-gold-500 font-semibold text-ink-900" : "border-ink-200 text-ink-600 hover:border-ink-400 hover:text-ink-900",
                          )}
                        >
                          <span className="truncate">{step.label}</span>
                          {step.state === "missing" ? (
                            <span className="text-[11px] font-semibold text-warn-600" title={`${step.missingCount} nog leeg`}>
                              {step.missingCount}
                            </span>
                          ) : step.state === "complete" ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-label="gedaan" />
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
