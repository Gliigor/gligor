"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, EmptyState } from "@/components/ui/card";
import { ArrowRight, Search } from "@/components/ui/icons";
import { Input } from "@/components/ui/form";
import { formatDateTime } from "@/lib/format";

interface Item {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  updated_at: string;
}

export function ClientList({ clients }: { clients: Item[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.company_name ?? ""}`.toLowerCase().includes(q),
    );
  }, [clients, query]);

  if (clients.length === 0) {
    return (
      <Card>
        <EmptyState title="Nog geen cliënten">
          Voeg je eerste cliënt toe met de <span className="font-semibold text-ink-700">+</span> rechtsboven.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <Input
          type="search"
          placeholder="Zoek op naam of bedrijf"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
          aria-label="Zoek cliënten"
        />
      </div>
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="Geen cliënten gevonden">Probeer een andere zoekterm.</EmptyState>
        ) : (
          <ul className="divide-y divide-ink-100">
            {filtered.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clienten/${c.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink-50 focus-visible:bg-ink-50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-ink-900">
                      {c.first_name} {c.last_name}
                    </div>
                    {c.company_name ? <div className="truncate text-sm text-ink-500">{c.company_name}</div> : null}
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-500 tabular">
                    <span className="hidden sm:inline">Gewijzigd </span>
                    {formatDateTime(c.updated_at)}
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-ink-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
