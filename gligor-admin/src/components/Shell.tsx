"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  CreditCard,
  FileText,
  Inbox,
  KanbanSquare,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { Kbd } from "./ui";
import { CommandPalette } from "./CommandPalette";
import { QuickNote } from "./QuickNote";

export interface ClientOption {
  id: string;
  company: string;
  owner: string;
  stage: string;
}

interface ShellCtx {
  openPalette: () => void;
  openNote: (clientId?: string) => void;
}

const Ctx = createContext<ShellCtx>({ openPalette: () => {}, openNote: () => {} });
export const useShell = () => useContext(Ctx);

const NAV = [
  { href: "/vandaag", label: "Vandaag", icon: CalendarCheck, key: "g v" },
  { href: "/klanten", label: "Klanten", icon: Users, key: "g k" },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare, key: "g p" },
  { href: "/tickets", label: "Tickets", icon: Inbox, key: "g t" },
  { href: "/betalingen", label: "Betalingen", icon: CreditCard, key: "g b" },
  { href: "/templates", label: "Templates", icon: FileText, key: "g e" },
  { href: "/instellingen", label: "Instellingen", icon: Settings, key: "g i" },
];

function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function Shell({
  children,
  clients,
  counts,
  demo,
}: {
  children: ReactNode;
  clients: ClientOption[];
  counts: { tickets: number; today: number; overdue: number };
  demo: boolean;
}) {
  const [palette, setPalette] = useState(false);
  const [note, setNote] = useState<{ open: boolean; clientId?: string; key: number }>({ open: false, key: 0 });
  const pathname = usePathname();
  const router = useRouter();

  const openPalette = useCallback(() => setPalette(true), []);
  const openNote = useCallback((clientId?: string) => setNote((n) => ({ open: true, clientId, key: n.key + 1 })), []);
  const closeNote = useCallback(() => setNote((n) => ({ ...n, open: false })), []);
  const closePalette = useCallback(() => setPalette(false), []);

  useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        const m = pathname.match(/^\/klanten\/([0-9a-f-]{36})/);
        openNote(m?.[1]);
        return;
      }
      if (e.key === "g") {
        pendingG = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => (pendingG = false), 800);
        return;
      }
      if (pendingG) {
        const item = NAV.find((n) => n.key === `g ${e.key}`);
        pendingG = false;
        if (item) {
          e.preventDefault();
          router.push(item.href);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router, openNote]);

  const ctx = useMemo(() => ({ openPalette, openNote }), [openPalette, openNote]);
  const badge = (href: string) =>
    href === "/tickets" ? counts.tickets : href === "/vandaag" ? counts.today : href === "/betalingen" ? counts.overdue : 0;

  return (
    <Ctx.Provider value={ctx}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col border-r border-line bg-sidebar md:flex">
          <div className="flex h-12 items-center px-4">
            <Link href="/vandaag" aria-label="Naar Vandaag">
              <Logo />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2" aria-label="Hoofdmenu">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
              const count = badge(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${
                    active ? "bg-tile text-fg" : "text-muted hover:bg-tile hover:text-fg"
                  }`}
                >
                  <n.icon className={`size-4 ${active ? "text-accent" : ""}`} strokeWidth={1.75} />
                  <span className="flex-1">{n.label}</span>
                  {count > 0 && (
                    <span
                      className={`num rounded px-1.5 text-[11px] ${
                        n.href === "/betalingen" ? "bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger" : "bg-tile-hover text-muted"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="space-y-1 border-t border-line px-4 py-3 text-[11px] text-muted">
            <div className="flex items-center justify-between">
              Zoeken <Kbd>⌘K</Kbd>
            </div>
            <div className="flex items-center justify-between">
              Nieuwe notitie <Kbd>N</Kbd>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {demo && (
            <div className="border-b border-line bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-4 py-1.5 text-center text-xs text-fg">
              Demo-modus: verzonnen gegevens, er wordt niets echt verstuurd. Zie README om te koppelen.
            </div>
          )}
          <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur">
            <div className="md:hidden">
              <Logo />
            </div>
            <button
              type="button"
              onClick={openPalette}
              className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-line bg-tile px-2.5 text-left text-muted transition-colors hover:bg-tile-hover"
            >
              <Search className="size-4" strokeWidth={1.75} />
              <span className="flex-1 truncate">Zoek klant, ticket of actie…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => openNote()}>
                <Plus className="size-4" strokeWidth={2} />
                <span className="hidden sm:inline">Notitie</span>
              </button>
            </div>
          </header>
          <nav className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1.5 md:hidden" aria-label="Menu">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded px-2 py-1 text-xs whitespace-nowrap ${pathname.startsWith(n.href) ? "bg-tile text-fg" : "text-muted"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">{children}</main>
        </div>
      </div>
      <CommandPalette open={palette} onClose={closePalette} clients={clients} onNote={openNote} />
      <QuickNote key={note.key} open={note.open} clientId={note.clientId} clients={clients} onClose={closeNote} />
    </Ctx.Provider>
  );
}

/** Knop die het notitievenster opent (bijv. vanuit Vandaag of een klantpagina). */
export function NoteButton({ clientId, className = "btn btn-sm", children }: { clientId?: string; className?: string; children?: ReactNode }) {
  const { openNote } = useShell();
  return (
    <button type="button" className={className} onClick={() => openNote(clientId)}>
      {children ?? "Notitie"}
    </button>
  );
}
