import { requireMember } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "Nieuwe cliënt" };

export default async function NewClientPage() {
  await requireMember();
  return (
    <div className="mx-auto max-w-xl space-y-7">
      <PageHeader back={{ href: "/clienten", label: "Cliënten" }} eyebrow="Toevoegen" title="Nieuwe cliënt" />
      <Card className="p-6">
        <NewClientForm />
      </Card>
    </div>
  );
}
