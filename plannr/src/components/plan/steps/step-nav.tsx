"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";

/** Vorige / Volgende under a step. Enter in a single-line field also goes to the next step. */
export function StepNav({
  baseHref,
  prev,
  next,
  nextLabel = "Volgende",
  extra,
  enterHint = true,
}: {
  baseHref: string;
  prev?: string;
  next?: string;
  nextLabel?: string;
  extra?: React.ReactNode;
  /** Show "of druk op Enter" (only on steps with fields). */
  enterHint?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!next) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      // Only from a plain input on the step itself, never from a dialog, menu or button.
      if (!(el instanceof HTMLInputElement) || ["checkbox", "radio", "button", "submit"].includes(el.type)) return;
      if (el.closest("[role=dialog], [data-no-enter-next]")) return;
      e.preventDefault();
      el.blur();
      router.push(`${baseHref}/${next}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [baseHref, next, router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-6">
      {prev ? (
        <LinkButton href={`${baseHref}/${prev}`} variant="ghost">
          <ArrowLeft className="h-4 w-4" /> Vorige
        </LinkButton>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-3">
        {extra}
        {next ? (
          <>
            <span className={enterHint ? "hidden text-xs text-ink-400 sm:inline" : "hidden"}>
              of druk op <kbd className="border border-ink-300 bg-white px-1.5 py-px font-sans text-[11px] text-ink-500">Enter ↵</kbd>
            </span>
            <LinkButton href={`${baseHref}/${next}`}>
              {nextLabel} <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </>
        ) : null}
      </div>
    </div>
  );
}
