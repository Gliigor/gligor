import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Plannr beheer", template: "%s · Plannr beheer" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col bg-ink-50">{children}</div>;
}
