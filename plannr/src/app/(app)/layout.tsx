import { requireMember } from "@/lib/auth";
import { AppFooter, AppHeader } from "@/components/layout/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember();
  return (
    <>
      <AppHeader name={member.profile.name || member.profile.email} firmName={member.firm.name} isOwner={member.isOwner} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <AppFooter />
    </>
  );
}
