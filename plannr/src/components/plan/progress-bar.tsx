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
  const active = useSelectedLayoutSegment() ?? "documenten";
  const activeIndex = Math.max(0, steps.findIndex((s) => s.key === active));
  const activeStep = steps[activeIndex];

  return (
    <nav aria-label="Stappen van het plan">
      <ol className="flex items-start gap-1.5 sm:gap-3">
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
                className="group block pt-0.5"
              >
                <span
                  className={cn(
                    "block h-[5px] w-full transition-colors",
                    step.state === "complete" && "bg-ink-900",
                    step.state === "missing" && "bg-warn-600",
                    step.state === "open" && "bg-ink-200 group-hover:bg-ink-300",
                    step.state === "not_applicable" &&
                      "bg-[repeating-linear-gradient(90deg,var(--color-ink-200)_0_6px,transparent_6px_10px)]",
                    isActive && "bg-gold-500",
                  )}
                />
                <span className="mt-2 flex items-center gap-1.5">
                  <span className="font-display text-[13px] font-semibold text-gold-700">{String(i + 1).padStart(2, "0")}</span>
                  <span
                    className={cn(
                      "hidden truncate text-[12.5px] sm:inline",
                      isActive ? "font-semibold text-ink-900" : step.state === "open" || step.state === "not_applicable" ? "text-ink-500" : "text-ink-800",
                    )}
                  >
                    {step.label}
                  </span>
                  {step.state === "complete" ? <Check className="hidden h-3.5 w-3.5 shrink-0 text-ink-500 md:block" aria-hidden="true" /> : null}
                  {step.state === "missing" ? (
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-warn-600" aria-hidden="true">
                      <AlertTriangle className="h-3 w-3" />
                      {step.missingCount}
                    </span>
                  ) : null}
                </span>
                <span className="sr-only">{title}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm font-medium text-ink-800 sm:hidden">
        Stap {activeIndex + 1} van {steps.length}: {activeStep?.label}
        {activeStep?.state === "missing" ? (
          <span className="ml-1 font-normal text-warn-600">· {activeStep.missingCount} ontbrekend</span>
        ) : null}
      </p>

    </nav>
  );
}
