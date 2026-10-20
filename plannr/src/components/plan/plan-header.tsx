"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Copy, GitCompare, Pencil, Trash2 } from "@/components/ui/icons";
import { createScenarioAction, deletePlanAction, updatePlanMeta } from "@/lib/actions/plan";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plan/types";

export function PlanHeader({
  planId,
  clientId,
  title,
  status,
  scenarioOf,
}: {
  planId: string;
  clientId: string;
  title: string;
  status: PlanStatus;
  /** The base plan when this plan is a scenario. */
  scenarioOf?: { id: string; title: string } | null;
}) {
  const [editing, setEditing] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [draft, setDraft] = useState(title);
  const [pending, startTransition] = useTransition();

  function saveTitle() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) startTransition(() => void updatePlanMeta(planId, { title: draft }));
    else setDraft(title);
  }

  return (
    <div className="space-y-3">
    <div className="flex items-end gap-2 sm:gap-3">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTitle();
              if (e.key === "Escape") {
                setDraft(title);
                setEditing(false);
              }
            }}
            className="w-full rounded-sm border border-ink-900 bg-white px-2 py-1 font-display text-[2rem] font-semibold leading-[1.1] focus:outline-none sm:text-[2.6rem]"
            aria-label="Titel van het plan"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-2 text-left">
            <h1 className="truncate text-[2rem] leading-[1.1] text-ink-900 sm:text-[2.6rem]">{draft}</h1>
            <Pencil className="h-4 w-4 shrink-0 text-ink-400 opacity-60 group-hover:opacity-100" aria-label="Titel wijzigen" />
          </button>
        )}
      </div>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => startTransition(() => void updatePlanMeta(planId, { status: e.target.value as PlanStatus }))}
        className="h-10 rounded-sm border border-ink-300 bg-white px-3 text-[13px] font-semibold text-ink-800 focus:border-ink-900 focus:outline-none"
        aria-label="Status van het plan"
      >
        {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
          <option key={s} value={s}>
            {PLAN_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (confirm("Dit plan verwijderen? Documenten en rapporten van dit plan worden ook verwijderd.")) {
            startTransition(() => deletePlanAction(planId, clientId));
          }
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-600"
        title="Plan verwijderen"
        aria-label="Plan verwijderen"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        {scenarioOf ? (
          <span className="text-ink-500">
            Scenario van{" "}
            <Link href={`/clienten/${clientId}/plannen/${scenarioOf.id}`} className="font-medium text-ink-800 underline decoration-gold-500 underline-offset-4">
              {scenarioOf.title}
            </Link>
          </span>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await createScenarioAction(planId);
              if (res && !res.ok) setScenarioError(res.error);
            })
          }
          className="inline-flex items-center gap-1.5 font-semibold text-ink-800 hover:text-ink-900 disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" /> Maak scenario
        </button>
        <Link href={`/clienten/${clientId}/vergelijken?plan=${planId}`} className="inline-flex items-center gap-1.5 font-semibold text-ink-800 hover:text-ink-900">
          <GitCompare className="h-3.5 w-3.5" /> Vergelijken
        </Link>
        {scenarioError ? <span className="text-danger-600">{scenarioError}</span> : null}
      </div>
    </div>
  );
}
