import Link from "next/link";
import { ArrowLeft } from "./icons";

/** Eyebrow + serif title + optional actions; used at the top of every page. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  back,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: React.ReactNode };
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {back ? (
        <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-4 w-4" /> {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
          <h1 className="text-[2rem] leading-[1.1] text-ink-900 sm:text-[2.6rem]">{title}</h1>
          {subtitle ? <p className="mt-2 text-[15px] text-ink-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
