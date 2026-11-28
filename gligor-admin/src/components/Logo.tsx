/** Woordmerk: "gligor.ai" cursief, met ".ai" in groen (zelfde als op gligor.ai). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-[17px] font-bold tracking-[-0.03em] text-fg italic ${className}`}>
      gligor
      <span className="pr-0.5 text-accent">.ai</span>
    </span>
  );
}
