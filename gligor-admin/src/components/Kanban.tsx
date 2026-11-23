"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { moveStageAction } from "@/app/actions";
import { STAGES, PACKAGES, type PackageKey, type Stage } from "@/lib/config";

export interface KanbanCard {
  id: string;
  company: string;
  owner: string;
  stage: Stage;
  package: PackageKey;
  days: number;
  attention: boolean;
}

/** Pipeline: sleep een kaart naar een andere kolom (of gebruik het menu op de kaart). */
export function Kanban({ cards }: { cards: KanbanCard[] }) {
  const [optimistic, move] = useOptimistic(cards, (state, { id, stage }: { id: string; stage: Stage }) =>
    state.map((c) => (c.id === id ? { ...c, stage, days: 0 } : c)),
  );
  const [, startTransition] = useTransition();
  const [over, setOver] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doMove = (id: string, stage: Stage) => {
    const card = optimistic.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    setError(null);
    startTransition(async () => {
      move({ id, stage });
      const res = await moveStageAction(id, stage);
      if (res?.error) setError(res.error);
    });
  };

  return (
    <>
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const list = optimistic.filter((c) => c.stage === s.key);
          return (
            <section
              key={s.key}
              aria-label={s.label}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.key);
              }}
              onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                doMove(e.dataTransfer.getData("text/plain"), s.key);
              }}
              className={`flex w-[230px] shrink-0 flex-col rounded-[8px] border bg-sidebar transition-colors ${
                over === s.key ? "border-accent" : "border-line"
              }`}
            >
              <header className="flex items-center justify-between border-b border-line px-3 py-2">
                <span className="label">{s.short ?? s.label}</span>
                <span className="num text-xs text-muted">{list.length}</span>
              </header>
              <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">
                {list.map((c) => (
                  <article
                    key={c.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", c.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    className="tile tile-hover cursor-grab p-2.5 active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/klanten/${c.id}`} className="font-medium leading-snug hover:underline">
                        {c.company}
                      </Link>
                      {c.attention && <span className="mt-1 size-2 shrink-0 rounded-full bg-danger" title="Heeft aandacht nodig" />}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{c.owner || "–"}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                      <span>{PACKAGES[c.package].label}</span>
                      <span className="num">{c.days === 0 ? "vandaag" : `${c.days} d in fase`}</span>
                    </div>
                    <select
                      aria-label={`Fase van ${c.company}`}
                      value={c.stage}
                      onChange={(e) => doMove(c.id, e.target.value as Stage)}
                      className="mt-2 h-7 w-full py-0 text-xs"
                    >
                      {STAGES.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
