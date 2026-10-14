export function Logo({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
        <rect x="1" y="1" width="22" height="22" fill="none" stroke="#a8834b" strokeWidth="1.5" />
        <path d="M6 16.5l4-4 3 3 5-6.5" fill="none" stroke="#a8834b" strokeWidth="1.6" strokeLinecap="square" />
      </svg>
      <span
        className={`font-display text-[1.45rem] font-semibold leading-none tracking-[0.01em] ${tone === "light" ? "text-ink-50" : "text-ink-900"}`}
      >
        Plannr
      </span>
    </span>
  );
}
