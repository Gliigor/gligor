import { cn } from "./cn";

/** A pulsing placeholder block, shown while the next screen loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-ink-100", className)} />;
}

/** Placeholder for a card with a header and a few rows. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-sm border border-ink-200 bg-white">
      <div className="border-b border-ink-100 px-5 py-4 sm:px-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="space-y-3 p-5 sm:p-6">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className={cn("h-9", i % 2 ? "w-4/5" : "w-full")} />
        ))}
      </div>
    </div>
  );
}
