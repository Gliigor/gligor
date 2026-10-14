import { CardSkeleton } from "@/components/ui/skeleton";

// Switching steps keeps the plan header and progress bar; only the step body waits.
export default function Loading() {
  return (
    <div className="space-y-5" role="status" aria-label="Laden">
      <CardSkeleton rows={4} />
      <CardSkeleton rows={3} />
    </div>
  );
}
