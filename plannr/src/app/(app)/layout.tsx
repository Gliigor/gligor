import { requireMember } from "@/lib/auth";
import { AppFooter, AppShell } from "@/components/layout/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <AppShell name={member.profile.name || member.profile.email} firmName={member.firm.name} isOwner={member.isOwner}>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-7 sm:px-8 sm:py-10 lg:px-12 lg:py-12">{children}</main>
      <AppFooter />
    </AppShell>
  );
}
