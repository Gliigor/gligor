import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSessionState } from "@/lib/auth";
import { isDemo } from "@/lib/env";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Tweestapsverificatie" };

export default async function MfaPage() {
  if (isDemo()) redirect("/vandaag");
  const s = await getSessionState();
  if (s.state === "anon") redirect("/login");
  if (s.state === "forbidden") redirect("/login?fout=geen-toegang");
  if (s.state === "ok") redirect("/vandaag");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="tile w-full max-w-sm p-6">
        <Logo className="text-[22px]" />
        <p className="mt-1 mb-5 text-[13px] text-muted">Tweestapsverificatie</p>
        <MfaForm />
      </div>
    </main>
  );
}
