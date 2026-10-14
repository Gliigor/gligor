import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { LogOut } from "@/components/ui/icons";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";

/** Dark sidebar on desktop, dark top bar on phones and tablets. */
export function AppShell({
  name,
  firmName,
  isOwner,
  children,
}: {
  name: string;
  firmName: string;
  isOwner: boolean;
  children: React.ReactNode;
}) {
  const logout = (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm text-[#b9bec6] hover:bg-white/[0.06] hover:text-white"
        title="Uitloggen"
        aria-label="Uitloggen"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-night px-4 py-7 lg:flex">
        <Link href="/clienten" className="mb-9 px-2" aria-label="Plannr – naar cliënten">
          <Logo tone="light" />
        </Link>
        <NavLinks isOwner={isOwner} />
        <div className="mt-auto flex items-center gap-2 border-t border-white/10 px-2 pt-4">
          <div className="min-w-0 flex-1 leading-snug">
            <div className="truncate text-[13px] font-semibold text-white">{name}</div>
            <div className="truncate text-xs text-[#9aa1ab]">{firmName}</div>
          </div>
          {logout}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 bg-night px-4 lg:hidden">
          <Link href="/clienten" aria-label="Plannr – naar cliënten">
            <Logo tone="light" />
          </Link>
          <NavLinks isOwner={isOwner} orientation="horizontal" />
          <div className="ml-auto">{logout}</div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-ink-200">
      <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-400 sm:px-8 lg:px-12">
        Plannr prototype — berekeningen zijn indicatief (prototype-rekenkern) en niet geschikt als financieel advies.
      </div>
    </footer>
  );
}
