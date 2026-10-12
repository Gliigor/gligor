export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden="true">
        <rect width="28" height="28" rx="7" fill="#1c3c61" />
        <path d="M7 19.5l5-5 3.5 3.5L21 10" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21" cy="10" r="2" fill="#7fb3e6" />
      </svg>
      <span className="text-lg">Plannr</span>
    </span>
  );
}
