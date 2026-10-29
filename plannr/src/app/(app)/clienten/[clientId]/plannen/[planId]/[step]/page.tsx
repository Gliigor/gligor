import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { calculatePlan } from "@/lib/engine";
import { isStepKey, LEGACY_STEPS, STEPS } from "@/lib/plan/definitions";
import { loadPlan } from "@/lib/plan/load";
import { clientHasCompany, findMissingFields, hasZakelijkStep } from "@/lib/plan/status";
import { toEngineInput } from "@/lib/plan/to-engine-input";
import { StepVisit } from "@/components/plan/step-visit";
import { StepNav } from "@/components/plan/steps/step-nav";
import { DocumentsStep } from "@/components/plan/steps/documents-step";
import { ControlStep } from "@/components/plan/steps/control-step";
import { ResultsView } from "@/components/plan/steps/results-view";
import { ReportStep } from "@/components/plan/steps/report-step";
import { InsightsPanel } from "@/components/plan/insights-panel";
import { ChoicesPanel } from "@/components/plan/choices-panel";
import { deriveInsights } from "@/lib/insights";
import { getAiReaderStatus } from "@/lib/extraction/ai/config";

// Reading a document with the AI reader can take a minute or two.
export const maxDuration = 300;

export async function generateMetadata({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]/[step]">) {
  const { step } = await params;
  return { title: STEPS.find((s) => s.key === step)?.label ?? "Plan" };
}

export default async function StepPage({ params }: PageProps<"/clienten/[clientId]/plannen/[planId]/[step]">) {
  const { clientId, planId, step } = await params;
  const base = `/clienten/${clientId}/plannen/${planId}`;
  if (LEGACY_STEPS[step]) redirect(`${base}/${LEGACY_STEPS[step]}`);
  if (!isStepKey(step)) notFound();
  const member = await requireMember();
  const bundle = await loadPlan(planId);
  if (!bundle || bundle.client.id !== clientId) notFound();

  const { config, inputs, assets } = bundle;
  const zakelijk = hasZakelijkStep(clientHasCompany(bundle.client));
  const steps = STEPS.filter((s) => s.key !== "zakelijk" || zakelijk);
  const index = steps.findIndex((s) => s.key === step);
  const prev = steps[index - 1]?.key;
  const next = steps[index + 1]?.key;

  let body: React.ReactNode;
  let nav: React.ReactNode = <StepNav baseHref={base} prev={prev} next={next} />;

  switch (step) {
    case "documenten":
      body = (
        <DocumentsStep
          firmId={member.firm.id}
          planId={planId}
          documents={bundle.documents}
          aiReader={member.firm.ai_extraction_enabled && getAiReaderStatus().configured}
          isOwner={member.isOwner}
          priveEnabled
          zakelijkEnabled={zakelijk}
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
    case "zakelijk":
      if (!zakelijk) {
        body = (
          <p className="border-l-2 border-gold-500 bg-white px-4 py-3 text-sm text-ink-700">
            Deze cliënt heeft geen bedrijf. Zet bij de cliënt &ldquo;Heeft ook een bedrijf&rdquo; aan om zakelijke gegevens op te nemen.
          </p>
        );
        break;
      }
    // falls through
    case "gezin":
    case "woning":
    case "inkomen":
    case "uitgaven":
    case "vermogen":
    case "uitgangspunten":
      body = (
        <ControlStep
          key={step}
          part={step}
          planId={planId}
          config={config}
          initialInputs={inputs}
          initialAssets={assets}
          firmReturns={member.firm.rendement_standaard}
        />
      );
      break;
    case "resultaten": {
      const engineInput = toEngineInput({
        config,
        inputs,
        assets,
        referenceYear: new Date().getFullYear(),
        clientName: bundle.client.first_name,
        firmReturns: member.firm.rendement_standaard,
      });
      const result = await calculatePlan(engineInput);
      const insights = deriveInsights(engineInput, result);
      const missing = findMissingFields(config, inputs, assets);
      body = (
        <div className="space-y-4">
          {missing.length > 0 ? (
            <p className="rounded-lg border border-warn-600/30 bg-warn-50 px-3 py-2 text-sm text-warn-600">
              Er {missing.length === 1 ? "ontbreekt nog 1 verplicht veld" : `ontbreken nog ${missing.length} verplichte velden`}; lege
              velden tellen als € 0. Vul ze aan bij{" "}
              {steps
                .filter((x) => missing.some((m) => m.step === x.key))
                .map((x, i, list) => (
                  <span key={x.key}>
                    {i > 0 ? (i === list.length - 1 ? " en " : ", ") : null}
                    <Link className="underline" href={`${base}/${x.key}`}>
                      {x.label}
                    </Link>
                  </span>
                ))}
              .
            </p>
          ) : null}
          <ResultsView
            result={result}
            insightsSlot={<InsightsPanel planId={planId} insights={insights} initialHidden={config.hiddenInsights} />}
            choicesSlot={<ChoicesPanel planId={planId} withBv={result.wealth.zakelijk.included && config.sections.bv} />}
          />
        </div>
      );
      break;
    }
    case "rapport":
      body = <ReportStep planId={planId} initialSections={config.reportSections} exports={bundle.exports} withZakelijk={zakelijk} />;
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
