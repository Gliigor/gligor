import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-sm font-semibold tracking-[0.01em] transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-ink-900 text-ink-50 hover:bg-black",
  secondary: "bg-white text-ink-900 border border-ink-300 hover:border-ink-900",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger: "bg-white text-danger-600 border border-ink-300 hover:border-danger-600 hover:bg-danger-50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-11 px-5 text-[13.5px]",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/** "+ Nieuw …" action used at the top right of lists. Collapses to a "+" on small screens. */
export function PlusLink({ href, label, compact = false }: { href: string; label: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={buttonClass("primary", compact ? "sm" : "md", "gap-2.5")}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-gold-500" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <span className={compact ? "sr-only" : "hidden sm:inline"}>{label}</span>
    </Link>
  );
}
