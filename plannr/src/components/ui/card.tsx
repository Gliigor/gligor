import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-sm border border-ink-200 bg-white", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="font-display text-[1.3rem] font-semibold leading-tight text-ink-900">{title}</h2>
        {description ? <p className="mt-1 text-[13px] text-ink-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-ink-800">{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-500">{children}</div> : null}
    </div>
  );
}
