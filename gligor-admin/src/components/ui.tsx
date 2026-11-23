import type { ReactNode } from "react";
import Link from "next/link";

export type Tone = "green" | "amber" | "red" | "grey" | "blue";

const PILL: Record<Tone, string> = {
  green: "text-accent bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]",
  amber: "text-warn bg-[color-mix(in_srgb,var(--warn)_14%,transparent)]",
  red: "text-danger bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]",
  grey: "text-muted bg-[color-mix(in_srgb,var(--muted)_16%,transparent)]",
  blue: "text-[#7cb7ff] bg-[color-mix(in_srgb,#7cb7ff_14%,transparent)]",
};

export function Pill({ tone = "grey", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ${PILL[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Tile({
  label,
  children,
  className = "",
  action,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`tile tile-hover p-4 ${className}`}>
      {(label || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {label && <h2 className="label">{label}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiTile({ label, value, hint, tone, href }: { label: string; value: string; hint?: string; tone?: Tone; href?: string }) {
  const body = (
    <>
      <div className="label">{label}</div>
      <div className={`num mt-2 text-[28px] leading-none font-semibold ${tone === "red" ? "text-danger" : tone === "green" ? "text-accent" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-2 text-xs text-muted">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="tile tile-hover block p-4">
      {body}
    </Link>
  ) : (
    <div className="tile tile-hover p-4">{body}</div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-line px-4 py-8 text-center text-muted">{children}</div>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="num inline-flex h-5 min-w-5 items-center justify-center rounded border border-line bg-bg px-1 text-[10px] text-muted">
      {children}
    </kbd>
  );
}

export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

/** Tabbladen als links (de actieve tab staat in de URL, ?tab=...). */
export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number }[]; active: string }) {
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Tabbladen">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] whitespace-nowrap transition-colors ${
            t.key === active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
          }`}
        >
          {t.label}
          {t.count !== undefined && t.count > 0 && <span className="num text-[11px] text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
