"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { REPORT_SECTIONS, SECTIONS, type Side } from "@/lib/plan/definitions";
import type { PlanConfig } from "@/lib/plan/types";
import { updatePlanConfig } from "@/lib/actions/plan";
import { SaveIndicator, useAutosave } from "../use-autosave";

export function ConfigStep({ planId, initialConfig }: { planId: string; initialConfig: PlanConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const { status, schedule } = useAutosave(300);

  function update(next: PlanConfig) {
    setConfig(next);
    schedule("config", () => updatePlanConfig(planId, next));
  }

  const group = (side: Side, title: string, description: string) => (
    <Card>
      <CardHeader title={title} description={description} />
      <ul className="divide-y divide-ink-100">
        {SECTIONS.filter((s) => s.side === side).map((s) => (
          <li key={s.key}>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-ink-50 sm:px-5">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                checked={config.sections[s.key]}
                onChange={(e) => update({ ...config, sections: { ...config.sections, [s.key]: e.target.checked } })}
              />
              <span>
                <span className="block font-medium text-ink-900">{s.label}</span>
                <span className="block text-sm text-ink-500">{s.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );

  const none = !Object.values(config.sections).some(Boolean);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">Kies wat dit plan behandelt. Niet-aangevinkte onderdelen worden verborgen in de volgende stappen.</p>
        <SaveIndicator status={status} />
      </div>
      {none ? (
        <p className="rounded-lg border border-warn-600/30 bg-warn-50 px-3 py-2 text-sm text-warn-600">
          Vink minimaal één onderdeel aan.
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {group("prive", "Privé", "Box 1 en box 3, op basis van de IB-aangifte")}
        {group("zakelijk", "Zakelijk", "Box 2, op basis van de jaarrekening")}
      </div>
      <Card>
        <CardHeader title="Rapportonderdelen" description="Wat de cliënt in het rapport ziet. Je kunt dit later in stap 6 nog aanpassen." />
        <div className="grid gap-x-6 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
          {REPORT_SECTIONS.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-ink-50">
              <input
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                checked={config.reportSections.includes(r.key)}
                onChange={(e) =>
                  update({
                    ...config,
                    reportSections: e.target.checked
                      ? [...config.reportSections, r.key]
                      : config.reportSections.filter((k) => k !== r.key),
                  })
                }
              />
              <span>
                <span className="block text-sm font-medium text-ink-900">{r.label}</span>
                <span className="block text-xs text-ink-500">{r.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}
