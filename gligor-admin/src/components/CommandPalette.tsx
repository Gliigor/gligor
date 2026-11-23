"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientOption } from "./Shell";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  clients,
  onNote,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  onNote: (clientId?: string) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      router.push(href);
      onClose();
    };
    const base: Command[] = [
      { id: "n", label: "Nieuwe notitie", hint: "N", group: "Acties", run: () => (onClose(), onNote()) },
      { id: "nk", label: "Nieuwe klant", group: "Acties", run: go("/klanten/nieuw") },
      { id: "nb", label: "Nieuwsbrief schrijven", group: "Acties", run: go("/templates/nieuwsbrief") },
      { id: "v", label: "Vandaag", hint: "g v", group: "Ga naar", run: go("/vandaag") },
      { id: "k", label: "Klanten", hint: "g k", group: "Ga naar", run: go("/klanten") },
      { id: "p", label: "Pipeline", hint: "g p", group: "Ga naar", run: go("/pipeline") },
      { id: "t", label: "Tickets", hint: "g t", group: "Ga naar", run: go("/tickets") },
      { id: "b", label: "Betalingen", hint: "g b", group: "Ga naar", run: go("/betalingen") },
      { id: "e", label: "Templates", hint: "g e", group: "Ga naar", run: go("/templates") },
      { id: "i", label: "Instellingen", hint: "g i", group: "Ga naar", run: go("/instellingen") },
    ];
    const clientCmds: Command[] = clients.map((c) => ({
      id: `c-${c.id}`,
      label: c.company,
      hint: c.owner,
      group: "Klanten",
      run: go(`/klanten/${c.id}`),
    }));
    const ticket = query.match(/^#?t-?(\d{3,})$/i);
    const ticketCmd: Command[] = ticket
      ? [{ id: "tk", label: `Ticket T-${ticket[1]} openen`, group: "Tickets", run: go(`/tickets?nummer=${ticket[1]}`) }]
      : [];
    const q = query.trim().toLowerCase();
    const all = [...ticketCmd, ...base, ...clientCmds];
    if (!q) return [...base, ...clientCmds.slice(0, 8)];
    return all.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(q) || c.group === "Tickets");
  }, [clients, query, router, onClose, onNote]);

  useEffect(() => setIndex(0), [query]);

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(commands.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[index]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Zoeken en acties"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-tile shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Zoek een klant, typ T-1001, of kies een actie…"
          className="h-11 w-full rounded-none border-0 border-b border-line bg-transparent px-4 text-[14px] focus:border-line"
          aria-label="Zoeken"
        />
        <ul className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
          {commands.length === 0 && <li className="px-4 py-6 text-center text-muted">Niets gevonden</li>}
          {commands.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <li key={c.id}>
                {header && <div className="label px-4 pt-2 pb-1">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === index}
                  onMouseEnter={() => setIndex(i)}
                  onClick={c.run}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-1.5 text-left ${i === index ? "bg-tile-hover" : ""}`}
                >
                  <span className="truncate">{c.label}</span>
                  {c.hint && <span className="shrink-0 text-xs text-muted">{c.hint}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
