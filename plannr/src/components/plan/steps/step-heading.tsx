/** The top of every step: where we are, the question and one short line. */
export function StepHeading({ position, title, lead, aside }: { position: string; title: string; lead?: string; aside?: React.ReactNode }) {
  return (
    <header>
      <div className="flex items-center justify-between gap-4 text-xs text-ink-500">
        <span className="hidden lg:inline">{position}</span>
        <span className="lg:hidden" />
        {aside}
      </div>
      <h1 className="mt-3 text-[2.1rem] leading-[1.1] text-ink-900 sm:text-[2.6rem]">{title}</h1>
      {lead ? <p className="mt-3 text-[15px] leading-relaxed text-ink-500">{lead}</p> : null}
    </header>
  );
}
