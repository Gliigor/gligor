import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "@/components/ui/icons";
import { NewClientForm } from "./new-client-form";

export const metadata = { title: "Nieuwe cliënt" };

export default async function NewClientPage() {
  await requireMember();
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link href="/clienten" className="inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Cliënten
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nieuwe cliënt</h1>
      <Card className="p-5">
        <NewClientForm />
      </Card>
    </div>
  );
}
