import { PageHeader } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { createClientAction } from "@/app/actions";

export const metadata = { title: "Nieuwe klant" };

export default function NieuweKlantPage() {
  return (
    <>
      <PageHeader title="Nieuwe klant" subtitle="Kies een fase: de automatische taken en e-mailconcepten van die fase worden direct aangemaakt." />
      <div className="tile p-5">
        <ClientForm action={createClientAction} submitLabel="Klant aanmaken" showStage />
      </div>
    </>
  );
}
