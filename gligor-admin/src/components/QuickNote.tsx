"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { addNoteAction, type ActionState } from "@/app/actions";
import { LOG_TYPE_LABEL, type LogType } from "@/lib/config";
import type { ClientOption } from "./Shell";

/** "Nieuwe notitie" van overal: kies een klant en leg vast wat er besproken is. */
export function QuickNote({
  open,
  clientId,
  clients,
  onClose,
}: {
  open: boolean;
  clientId?: string;
  clients: ClientOption[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addNoteAction, null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>(clientId ?? "");
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelected(clientId ?? "");
      setSearch("");
      setTimeout(() => (clientId ? summaryRef.current : searchRef.current)?.focus(), 0);
    }
  }, [open, clientId]);

  // Na opslaan één keer sluiten (de Shell geeft elk nieuw venster een nieuwe key, dus een verse state).
  const closedFor = useRef<ActionState>(null);
  useEffect(() => {
    if (state?.ok && closedFor.current !== state) {
      closedFor.current = state;
      onClose();
    }
  }, [state, onClose]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || `${c.company} ${c.owner}`.toLowerCase().includes(q)).slice(0, 6);
  }, [clients, search]);

  if (!open) return null;
  const chosen = clients.find((c) => c.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh]" onMouseDown={onClose}>
      <form
        action={action}
        role="dialog"
        aria-modal="true"
        aria-label="Nieuwe notitie"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget as HTMLFormElement).requestSubmit();
        }}
        className="w-full max-w-lg space-y-3 rounded-lg border border-line bg-tile p-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Nieuwe notitie</h2>
          <span className="text-xs text-muted">⌘↵ om op te slaan</span>
        </div>

        <input type="hidden" name="client_id" value={selected} />
        {chosen ? (
          <div className="flex items-center justify-between rounded-md border border-line bg-bg px-3 py-2">
            <span>
              {chosen.company} <span className="text-muted">· {chosen.owner}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected("")}>
              Wijzig
            </button>
          </div>
        ) : (
          <div>
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered[0]) {
                    setSelected(filtered[0].id);
                    setTimeout(() => summaryRef.current?.focus(), 0);
                  }
                }
              }}
              placeholder="Klant zoeken…"
              className="w-full"
              aria-label="Klant zoeken"
            />
            {clients.length === 0 ? (
              <p className="mt-2 rounded-md border border-line bg-bg px-3 py-2 text-[13px] text-muted">
                Je hebt nog geen klanten. Een notitie hoort altijd bij een klant (of lead).{" "}
                <Link href="/klanten/nieuw" className="link" onClick={onClose}>
                  Maak eerst een klant aan
                </Link>
                .
              </p>
            ) : (
              filtered.length === 0 && <p className="mt-2 px-2 text-[13px] text-muted">Geen klant gevonden met &quot;{search}&quot;.</p>
            )}
            <ul className="mt-1 max-h-48 overflow-y-auto">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full justify-between rounded px-2 py-1.5 text-left hover:bg-tile-hover"
                    onClick={() => {
                      setSelected(c.id);
                      setTimeout(() => summaryRef.current?.focus(), 0);
                    }}
                  >
                    <span>{c.company}</span>
                    <span className="text-xs text-muted">{c.owner}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(Object.keys(LOG_TYPE_LABEL) as LogType[]).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs has-[:checked]:border-accent has-[:checked]:text-fg">
              <input type="radio" name="type" value={t} defaultChecked={t === "gesprek"} className="sr-only" />
              {LOG_TYPE_LABEL[t]}
            </label>
          ))}
        </div>
        <textarea ref={summaryRef} name="summary" required rows={4} placeholder="Wat is er besproken?" className="w-full" />
        <textarea name="agreed_actions" rows={2} placeholder="Afgesproken acties (één per regel)" className="w-full" />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            Opvolgen op
            <input type="date" name="follow_up_date" />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="make_tasks" /> Acties direct als taken
          </label>
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <div className="flex items-center justify-end gap-2">
          {!selected && clients.length > 0 && <span className="mr-auto text-xs text-warn">Kies eerst een klant</span>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending || !selected}>
            {pending ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}
