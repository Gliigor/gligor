import { redirect } from "next/navigation";
import { getAuthUserId, getMember } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { recheckMembership, signOut } from "../actions";

export const metadata = { title: "Geen kantoor" };

export default async function NoFirmPage() {
  if (!(await getAuthUserId())) redirect("/inloggen");
  if (await getMember()) redirect("/clienten");
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Nog geen kantoor gekoppeld</h1>
      <p className="mb-6 text-sm text-ink-600">
        Je account is (nog) niet aan een kantoor gekoppeld. Vraag de eigenaar van je kantoor om je uit te nodigen op dit
        e-mailadres.
      </p>
      <div className="space-y-2">
        <form action={recheckMembership}>
          <Button className="w-full">Opnieuw controleren</Button>
        </form>
        <form action={signOut}>
          <Button variant="secondary" className="w-full">
            Uitloggen
          </Button>
        </form>
      </div>
    </>
  );
}
