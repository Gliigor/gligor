"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { updateHiddenInsights } from "@/lib/actions/plan";
import { INSIGHT_TONE_LABELS, type Insight, type InsightTone } from "@/lib/insights";
import { formatEuro } from "@/lib/format";
import { SaveIndicator, useAutosave } from "./use-autosave";

const TONE_BADGE: Record<InsightTone, "warn" | "ok" | "neutral"> = { aandacht: "warn", kans: "ok", info: "neutral" };

/** The "Aandachtspunten" for a plan; the planner decides which ones go into the report. */
export function InsightsPanel({ planId, insights, initialHidden }: { planId: string; insights: Insight[]; initialHidden: string[] }) {
  const [hidden, setHidden] = useState(initialHidden);
  const { status, schedule } = useAutosave(300);

  function toggle(id: string, include: boolean) {
    const next = include ? hidden.filter((h) => h !== id) : [...hidden, id];
    setHidden(next);
    schedule("hidden-insights", () => updateHiddenInsights(planId, next));
  }

  return (
    <Card>
      <CardHeader
        title="Aandachtspunten"
        description="Kansen en risico's op basis van de ingevulde gegevens. Vink uit wat niet in het rapport hoort."
        action={<SaveIndicator status={status} />}
      />
      {insights.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-500">Geen bijzondere aandachtspunten gevonden.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {insights.map((i) => {
            const included = !hidden.includes(i.id);
            return (
              <li key={i.id} className={`flex gap-4 px-4 py-4 sm:px-5 ${included ? "" : "opacity-55"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE_BADGE[i.tone]}>{INSIGHT_TONE_LABELS[i.tone]}</Badge>
                    <span className="font-semibold text-ink-900">{i.title}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{i.body}</p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-600"
                      checked={included}
                      onChange={(e) => toggle(i.id, e.target.checked)}
                    />
                    Opnemen in rapport
                  </label>
                </div>
                {i.amount ? (
                  <div className="w-28 shrink-0 text-right">
                    <div className="font-semibold tabular text-ink-900">{formatEuro(i.amount.value, { whole: true })}</div>
                    <div className="text-xs text-ink-500">{i.amount.label}</div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
