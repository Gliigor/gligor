"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/form";
import { Pencil, Trash2 } from "@/components/ui/icons";
import { deletePlanAction, updatePlanMeta } from "@/lib/actions/plan";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plan/types";

export function PlanHeader({
  planId,
  clientId,
  title,
  status,
}: {
  planId: string;
  clientId: string;
  title: string;
  status: PlanStatus;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [pending, startTransition] = useTransition();

  function saveTitle() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) startTransition(() => void updatePlanMeta(planId, { title: draft }));
    else setDraft(title);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
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
            className="w-full rounded-lg border border-brand-500 px-2 py-1 text-2xl font-semibold tracking-tight focus:outline-none"
            aria-label="Titel van het plan"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-2 text-left">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{draft}</h1>
            <Pencil className="h-4 w-4 shrink-0 text-ink-400 opacity-60 group-hover:opacity-100" aria-label="Titel wijzigen" />
          </button>
        )}
      </div>
      <Select
        value={status}
        disabled={pending}
        onChange={(e) => startTransition(() => void updatePlanMeta(planId, { status: e.target.value as PlanStatus }))}
        className="w-auto py-1.5 text-sm"
        aria-label="Status van het plan"
      >
        {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
          <option key={s} value={s}>
            {PLAN_STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
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
  );
}
