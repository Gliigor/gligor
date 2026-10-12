"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { AlertTriangle, Check } from "@/components/ui/icons";
import type { StepStatus } from "@/lib/plan/status";

/**
 * Progress bar made of squares, one per step. Every square is a link: the
 * planner can jump to any step at any time.
 */
export function ProgressBar({ baseHref, steps }: { baseHref: string; steps: StepStatus[] }) {
  const active = useSelectedLayoutSegment() ?? "configuratie";
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === active));
  const activeStep = steps[activeIndex];

  return (
    <nav aria-label="Stappen van het plan">
      <ol className="flex items-start gap-1.5 sm:gap-2">
        {steps.map((step, i) => {
          const isActive = step.key === active;
          const title =
            step.state === "missing"
              ? `${step.label}: ${step.missingCount} ${step.missingCount === 1 ? "veld ontbreekt" : "velden ontbreken"}`
              : step.state === "complete"
                ? `${step.label}: gereed`
                : step.state === "not_applicable"
                  ? `${step.label}: niet van toepassing`
                  : step.label;
          return (
            <li key={step.key} className="min-w-0 flex-1">
              <Link
                href={`${baseHref}/${step.key}`}
                title={title}
                aria-current={isActive ? "step" : undefined}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "flex h-9 w-full items-center justify-center rounded-md border text-sm font-semibold transition-colors sm:h-10",
                    step.state === "complete" && "border-brand-600 bg-brand-600 text-white",
                    step.state === "missing" && "border-warn-600 bg-warn-100 text-warn-600",
                    step.state === "open" && "border-ink-300 bg-white text-ink-500 group-hover:border-ink-400",
                    step.state === "not_applicable" && "border-dashed border-ink-300 bg-ink-50 text-ink-400",
                    isActive && "ring-2 ring-brand-500 ring-offset-2",
                  )}
                >
                  {step.state === "complete" ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : step.state === "missing" ? (
                    <span aria-hidden="true" className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {step.missingCount}
                    </span>
                  ) : (
                    <span aria-hidden="true">{i + 1}</span>
                  )}
                  <span className="sr-only">{title}</span>
                </span>
                <span
                  className={cn(
                    "hidden w-full truncate text-center text-xs sm:block",
                    isActive ? "font-semibold text-ink-900" : "text-ink-500",
                  )}
                >
                  {step.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-sm font-medium text-ink-800 sm:hidden">
        Stap {activeIndex + 1} van {steps.length}: {activeStep?.label}
        {activeStep?.state === "missing" ? (
          <span className="ml-1 font-normal text-warn-600">· {activeStep.missingCount} ontbrekend</span>
        ) : null}
      </p>
      <div className="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 sm:flex">
        <Legend className="border-brand-600 bg-brand-600" label="Gereed" />
        <Legend className="border-warn-600 bg-warn-100" label="Velden ontbreken" />
        <Legend className="border-ink-300 bg-white" label="Nog open" />
        <Legend className="border-dashed border-ink-300 bg-ink-50" label="N.v.t." />
      </div>
    </nav>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded-sm border", className)} />
      {label}
    </span>
  );
}
