import { LinkButton } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";

export function StepNav({
  baseHref,
  prev,
  next,
  nextLabel = "Doorgaan",
  extra,
}: {
  baseHref: string;
  prev?: string;
  next?: string;
  nextLabel?: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 pt-5">
      {prev ? (
        <LinkButton href={`${baseHref}/${prev}`} variant="ghost">
          <ArrowLeft className="h-4 w-4" /> Vorige
        </LinkButton>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {extra}
        {next ? (
          <LinkButton href={`${baseHref}/${next}`}>
            {nextLabel} <ArrowRight className="h-4 w-4" />
          </LinkButton>
        ) : null}
      </div>
    </div>
  );
}
