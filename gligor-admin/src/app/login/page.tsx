import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSessionState } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Inloggen" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fout?: string }> }) {
  if (isDemo()) redirect("/vandaag");
  const { fout } = await searchParams;
  const s = await getSessionState();
  if (s.state === "ok") redirect("/vandaag");
  if (s.state === "needs-mfa") redirect("/login/2fa");

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="tile w-full max-w-sm p-6">
        <Logo className="text-[22px]" />
        <p className="mt-1 mb-5 text-[13px] text-muted">Beheer. Alleen voor Gligor.</p>
        {(fout === "geen-toegang" || s.state === "forbidden") && (
          <p className="mb-4 rounded-md border border-line px-3 py-2 text-sm text-danger">Dit account heeft geen toegang.</p>
        )}
        {fout === "link" && <p className="mb-4 rounded-md border border-line px-3 py-2 text-sm text-danger">De inloglink is verlopen of al gebruikt.</p>}
        <LoginForm />
      </div>
    </main>
  );
}
