import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { calculatePlan } from "@/lib/engine";
import { isStepKey, STEPS } from "@/lib/plan/definitions";
import { loadPlan } from "@/lib/plan/load";
import { findMissingFields, sideHasSections } from "@/lib/plan/status";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { StepVisit } from "@/components/plan/step-visit";
import { StepNav } from "@/components/plan/steps/step-nav";
import { ConfigStep } from "@/components/plan/steps/config-step";
import { DocumentsStep } from "@/components/plan/steps/documents-step";
import { ControlStep } from "@/components/plan/steps/control-step";
import { ResultsView } from "@/components/plan/steps/results-view";
import { ReportStep } from "@/components/plan/steps/report-step";
import { InsightsPanel } from "@/components/plan/insights-panel";
import { deriveInsights } from "@/lib/insights";

export async function generateMetadata({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]/[step]">) {
  const { step } = await params;
  return { title: STEPS.find((s) => s.key === step)?.label ?? "Plan" };
}

export default async function StepPage({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]/[step]">) {
  const { clientId, planId, step } = await params;
  if (!isStepKey(step)) notFound();
  const member = await requireMember();
  const bundle = await loadPlan(planId);
  if (!bundle || bundle.client.id !== clientId) notFound();

  const base = `/clienten/${clientId}/plannen/${planId}`;
  const index = STEPS.findIndex((s) => s.key === step);
  const prev = STEPS[index - 1]?.key;
  const next = STEPS[index + 1]?.key;
  const { config, inputs, assets } = bundle;

  let body: React.ReactNode;
  let nav: React.ReactNode = <StepNav baseHref={base} prev={prev} next={next} />;

  switch (step) {
    case "configuratie":
      body = <ConfigStep planId={planId} initialConfig={config} />;
      break;
    case "documenten":
      body = (
        <DocumentsStep
          firmId={member.firm.id}
          planId={planId}
          documents={bundle.documents}
          priveEnabled={sideHasSections("prive", config)}
          zakelijkEnabled={sideHasSections("zakelijk", config)}
        />
      );
      nav = (
        <StepNav
          baseHref={base}
          prev={prev}
          next={next}
          extra={
            bundle.documents.length === 0 ? (
              <Link href={`${base}/${next}`} className="px-3 text-sm font-medium text-ink-500 hover:text-ink-800">
                Overslaan
              </Link>
            ) : null
          }
        />
      );
      break;
    case "prive":
    case "zakelijk":
      body = (
        <ControlStep
          key={step}
          side={step}
          planId={planId}
          config={config}
          initialInputs={inputs}
          initialAssets={assets}
        />
      );
      break;
    case "resultaten": {
      const engineInput = toEngineInput({ config, inputs, assets, referenceYear: new Date().getFullYear() });
      const result = await calculatePlan(engineInput);
      const insights = deriveInsights(engineInput, result);
      const missing = findMissingFields(config, inputs, assets);
      body = (
        <div className="space-y-4">
          {missing.length > 0 ? (
            <p className="rounded-lg border border-warn-600/30 bg-warn-50 px-3 py-2 text-sm text-warn-600">
              Er {missing.length === 1 ? "ontbreekt nog 1 verplicht veld" : `ontbreken nog ${missing.length} verplichte velden`}; lege
              velden tellen als € 0. Vul ze aan bij{" "}
              {missing.some((m) => m.side === "prive") ? (
                <Link className="underline" href={`${base}/prive`}>
                  Privé
                </Link>
              ) : null}
              {missing.some((m) => m.side === "prive") && missing.some((m) => m.side === "zakelijk") ? " en " : null}
              {missing.some((m) => m.side === "zakelijk") ? (
                <Link className="underline" href={`${base}/zakelijk`}>
                  Zakelijk
                </Link>
              ) : null}
              .
            </p>
          ) : null}
          <ResultsView
            result={result}
            insightsSlot={<InsightsPanel planId={planId} insights={insights} initialHidden={config.hiddenInsights} />}
          />
        </div>
      );
      break;
    }
    case "rapport":
      body = <ReportStep planId={planId} initialSections={config.reportSections} exports={bundle.exports} />;
      break;
  }

  return (
    <div className="space-y-6">
      <StepVisit planId={planId} step={step} />
      {body}
      {nav}
    </div>
  );
}
