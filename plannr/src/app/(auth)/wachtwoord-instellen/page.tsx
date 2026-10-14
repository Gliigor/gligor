import { redirect } from "next/navigation";
import { getAuthUserId } from "@/lib/auth";
import { SetPasswordForm } from "../auth-forms";

export const metadata = { title: "Wachtwoord instellen" };

export default async function SetPasswordPage() {
  if (!(await getAuthUserId())) redirect("/inloggen?melding=link-ongeldig");
  return (
    <>
      <h1 className="mb-2 text-[2.2rem] leading-tight">Welkom bij Plannr</h1>
      <p className="mb-6 text-sm text-ink-500">Kies een wachtwoord om je account af te ronden.</p>
      <SetPasswordForm />
    </>
  );
}
