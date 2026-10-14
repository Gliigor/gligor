import { cn } from "./cn";

type Tone = "neutral" | "brand" | "ok" | "warn" | "doc" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-50 text-brand-700",
  ok: "bg-ok-50 text-ok-600",
  warn: "bg-warn-50 text-warn-600",
  doc: "bg-doc-50 text-doc-600",
  danger: "bg-danger-50 text-danger-600",
};

export function Badge({ tone = "neutral", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.02em] whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}
