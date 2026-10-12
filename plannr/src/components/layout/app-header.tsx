import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { LogOut } from "@/components/ui/icons";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

export function AppHeader({ name, firmName, isOwner }: { name: string; firmName: string; isOwner: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link href="/clienten" className="text-ink-900" aria-label="Plannr – naar cliënten">
          <Logo />
        </Link>
        <NavLinks isOwner={isOwner} />
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-sm font-medium text-ink-800">{name}</div>
            <div className="text-xs text-ink-500">{firmName}</div>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              title="Uitloggen"
              aria-label="Uitloggen"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-ink-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 text-xs text-ink-400">
        Plannr prototype — berekeningen zijn indicatief (prototype-rekenkern) en niet geschikt als financieel advies.
      </div>
    </footer>
  );
}
