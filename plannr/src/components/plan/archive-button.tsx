"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Archive, ArchiveRestore } from "@/components/ui/icons";
import { setPlanArchived } from "@/lib/actions/plan";

/** Archive a plan, or put an archived plan back. */
export function ArchiveButton({
  planId,
  archived,
  title,
  compact = false,
  className,
}: {
  planId: string;
  archived: boolean;
  title: string;
  /** Icon only (in lists). */
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const label = archived ? "Terugzetten" : "Archiveren";
  const Icon = archived ? ArchiveRestore : Archive;

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        disabled={pending}
        title={compact ? `${title} ${archived ? "terugzetten" : "archiveren"}` : undefined}
        aria-label={compact ? `${title} ${archived ? "terugzetten" : "archiveren"}` : undefined}
        onClick={() => {
          if (!archived && !confirm(`"${title}" archiveren? Het plan blijft bewaard en kan worden teruggezet.`)) return;
          start(async () => {
            const res = await setPlanArchived(planId, !archived);
            if (!res.ok) setError(res.error ?? "Er ging iets mis.");
            else router.refresh();
          });
        }}
        className={cn(
          "inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-800 hover:text-ink-900 disabled:opacity-50",
          compact && "h-8 w-8 justify-center rounded-sm text-ink-400 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {compact ? null : label}
      </button>
      {error ? <span className="text-xs text-danger-600">{error}</span> : null}
    </span>
  );
}
