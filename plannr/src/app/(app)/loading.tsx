import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

// Shown instantly on navigation inside the app while the server prepares the page.
export default function Loading() {
  return (
    <div className="space-y-7" role="status" aria-label="Laden">
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-9 w-72 max-w-full" />
      </div>
      <CardSkeleton rows={4} />
      <CardSkeleton rows={2} />
    </div>
  );
}
