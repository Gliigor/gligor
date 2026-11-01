import { ViewTransition } from "react";
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
import { StepHeading } from "@/components/plan/steps/step-heading";
import { stepCopy } from "@/components/plan/steps/step-copy";
import { cn } from "@/components/ui/cn";
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

const domId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");

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

  const copy = stepCopy(step, {
    client: bundle.client.first_name,
    partner: config.sections.partner ? inputs.partner.naam || "partner" : null,
    hasCompany: zakelijk,
  });
  const position = `Stap ${index + 1} van ${steps.length}`;
  // Questions sit in a narrow column; documents, results and the report use the full width.
  const wide = step === "documenten" || step === "resultaten" || step === "rapport" || step === "zakelijk";

  async function calculate() {
    const engineInput = toEngineInput({
      config,
      inputs,
      assets,
      referenceYear: new Date().getFullYear(),
      clientName: bundle!.client.first_name,
      firmReturns: member.firm.rendement_standaard,
    });
    return { engineInput, result: await calculatePlan(engineInput) };
  }

  let body: React.ReactNode;
  let nav: React.ReactNode = <StepNav baseHref={base} prev={prev} next={next} enterHint={!wide || step === "zakelijk"} />;

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
    case "client":
    case "partner":
    case "kinderen":
    case "inkomen":
    case "pensioen":
    case "posten":
    case "uitgaven":
    case "woning":
    case "vermogen":
    case "uitgangspunten":
      body = (
        <ControlStep
          key={step}
          part={step}
          heading={{ position, title: copy.title, lead: copy.lead, clientName: bundle.client.first_name }}
          planId={planId}
          config={config}
          initialInputs={inputs}
          initialAssets={assets}
          firmReturns={member.firm.rendement_standaard}
        />
      );
      break;
    case "resultaten": {
      const { engineInput, result } = await calculate();
      const stepLabel = new Map(steps.map((x) => [x.key, x.label]));
      const missing = findMissingFields(config, inputs, assets)
        .filter((m) => stepLabel.has(m.step))
        .map((m) => ({ id: m.id, label: m.label, stepLabel: stepLabel.get(m.step)!, href: `${base}/${m.step}#veld-${domId(m.id)}` }));
      body = (
        <ResultsView
          result={result}
          insights={deriveInsights(engineInput, result)}
          missing={missing}
          choicesSlot={<ChoicesPanel planId={planId} withBv={result.wealth.zakelijk.included && config.sections.bv} />}
        />
      );
      break;
    }
    case "rapport": {
      const { engineInput, result } = await calculate();
      body = (
        <div className="space-y-8">
          <ReportStep planId={planId} initialSections={config.reportSections} exports={bundle.exports} withZakelijk={zakelijk} />
          <InsightsPanel planId={planId} insights={deriveInsights(engineInput, result)} initialHidden={config.hiddenInsights} />
        </div>
      );
      break;
    }
  }

  // ControlStep renders its own heading (with the save state); the other steps get it here.
  const ownHeading = step === "documenten" || step === "resultaten" || step === "rapport" || (step === "zakelijk" && !zakelijk);
  return (
    <ViewTransition key={step} name="plan-step" share="auto" enter="auto" default="none">
      <div className={cn("space-y-10", !wide && "max-w-[680px]")}>
        <StepVisit planId={planId} step={step} />
        {ownHeading ? <StepHeading position={position} title={copy.title} lead={copy.lead} /> : null}
        {body}
        {nav}
      </div>
    </ViewTransition>
  );
}
