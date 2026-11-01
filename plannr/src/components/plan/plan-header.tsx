"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, MoreHorizontal, Trash2 } from "@/components/ui/icons";
import { ArchiveButton } from "./archive-button";
import { ComparePicker, type PickablePlan } from "./compare-picker";
import { createScenarioAction, deletePlanAction, updatePlanMeta } from "@/lib/actions/plan";
import { PLAN_STATUS_LABELS, type PlanStatus } from "@/lib/plan/types";

/**
 * One quiet line above the steps: the client, the plan title (click to rename)
 * and a "···" menu with everything else (status, scenario, compare, archive, delete).
 */
export function PlanHeader({
  planId,
  clientId,
  clientName,
  title,
  status,
  scenarioOf,
  archivedAt,
  clientPlans = [],
}: {
  planId: string;
  clientId: string;
  clientName: string;
  title: string;
  status: PlanStatus;
  /** The base plan when this plan is a scenario. */
  scenarioOf?: { id: string; title: string } | null;
  archivedAt?: string | null;
  /** All plans of the client, for the compare picker. */
  clientPlans?: PickablePlan[];
}) {
  const [editing, setEditing] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [draft, setDraft] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  function saveTitle() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) startTransition(() => void updatePlanMeta(planId, { title: draft }));
    else setDraft(title);
  }

  const item = "flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-ink-800 hover:bg-ink-50";

  return (
    <div className="space-y-3" data-no-enter-next>
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-[13px] text-ink-500">
          <Link href={`/clienten/${clientId}`} className="inline-flex shrink-0 items-center gap-1.5 hover:text-ink-900">
            <ArrowLeft className="h-3.5 w-3.5" /> {clientName}
          </Link>
          <span aria-hidden="true">/</span>
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
              className="min-w-0 rounded-sm border border-ink-900 bg-white px-2 py-0.5 font-semibold text-ink-900 focus:outline-none"
              aria-label="Titel van het plan"
            />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="truncate font-semibold text-ink-900 hover:underline" title="Titel wijzigen">
              {draft}
            </button>
          )}
          {scenarioOf ? (
            <span className="hidden truncate sm:inline">
              · scenario van{" "}
              <Link href={`/clienten/${clientId}/plannen/${scenarioOf.id}`} className="text-ink-800 underline decoration-gold-500 underline-offset-4">
                {scenarioOf.title}
              </Link>
            </span>
          ) : null}
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Meer acties voor dit plan"
            className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-ink-200 bg-white text-ink-700 hover:border-ink-400"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-30 mt-2 w-64 rounded-sm border border-ink-200 bg-white py-1.5 shadow-lg">
              <label className="flex items-center justify-between gap-3 px-4 py-2 text-[13px] text-ink-600">
                Status
                <select
                  value={status}
                  disabled={pending}
                  onChange={(e) => startTransition(() => void updatePlanMeta(planId, { status: e.target.value as PlanStatus }))}
                  className="h-8 rounded-sm border border-ink-300 bg-white px-2 text-[13px] font-semibold text-ink-800 focus:border-ink-900 focus:outline-none"
                  aria-label="Status van het plan"
                >
                  {(Object.keys(PLAN_STATUS_LABELS) as PlanStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {PLAN_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="my-1 border-t border-ink-100" />
              <button
                type="button"
                disabled={pending}
                className={item}
                onClick={() =>
                  startTransition(async () => {
                    const res = await createScenarioAction(planId);
                    if (res && !res.ok) setScenarioError(res.error);
                  })
                }
              >
                <Copy className="h-3.5 w-3.5" /> Maak scenario
              </button>
              {clientPlans.length > 1 ? (
                <div className="px-4 py-2.5">
                  <ComparePicker clientId={clientId} plans={clientPlans} preselect={[planId]} />
                </div>
              ) : null}
              <div className="px-4 py-2.5 text-[13px]">
                <ArchiveButton planId={planId} archived={Boolean(archivedAt)} title={title} />
              </div>
              <div className="my-1 border-t border-ink-100" />
              <button
                type="button"
                className={`${item} text-danger-600 hover:bg-danger-50`}
                onClick={() => {
                  if (confirm("Dit plan verwijderen? Documenten en rapporten van dit plan worden ook verwijderd.")) {
                    startTransition(() => deletePlanAction(planId, clientId));
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Plan verwijderen
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {scenarioError ? <p className="text-sm text-danger-600">{scenarioError}</p> : null}
      {archivedAt ? (
        <div className="border-l-2 border-ink-400 bg-ink-100 px-4 py-2.5 text-sm text-ink-700">
          Dit plan is gearchiveerd. Het staat niet meer in de lijst met plannen; zet het terug via het menu ···.
        </div>
      ) : null}
    </div>
  );
}
