/** Woordmerk: "gligor" met ".ai" in groen en cursief. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline text-[17px] font-bold tracking-[-0.03em] text-fg ${className}`}>
      gligor
      <span className="pr-0.5 text-accent italic">.ai</span>
    </span>
  );
}
