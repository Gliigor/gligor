"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export function NavLinks({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const links = [{ href: "/clienten", label: "Cliënten" }];
  if (isOwner) links.push({ href: "/instellingen", label: "Instellingen" });
  return (
    <nav className="flex items-center gap-1">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
