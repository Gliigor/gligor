import { redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/auth";
import { Logo } from "@/components/layout/logo";
import { AdminLoginForm } from "./form";

export const metadata = { title: "Inloggen" };

export default async function AdminLoginPage() {
  if (await isSuperAdmin()) redirect("/admin");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Logo />
        <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs font-medium text-white">beheer</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-lg font-semibold">Inloggen beheer</h1>
        <AdminLoginForm />
      </div>
    </main>
  );
}
