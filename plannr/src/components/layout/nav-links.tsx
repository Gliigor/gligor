"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

export function NavLinks({ isOwner, orientation = "vertical" }: { isOwner: boolean; orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const links = [
    { href: "/clienten", label: "Cliënten" },
    { href: "/downloads", label: "Downloads" },
  ];
  if (isOwner) links.push({ href: "/instellingen", label: "Instellingen" });
  return (
    <nav className={cn("flex", orientation === "vertical" ? "flex-col gap-1" : "items-center gap-1")}>
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-[13.5px] font-medium tracking-[0.01em] transition-colors",
              orientation === "vertical"
                ? "rounded-sm px-3 py-2.5"
                : "px-2.5 py-1.5",
              active
                ? orientation === "vertical"
                  ? "bg-white/[0.07] text-white shadow-[inset_2px_0_0_var(--color-gold-500)]"
                  : "text-white shadow-[inset_0_-2px_0_var(--color-gold-500)]"
                : "text-[#b9bec6] hover:bg-white/[0.04] hover:text-white",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
