import { requireMember } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Download, FileSpreadsheet, FileText, Printer } from "@/components/ui/icons";

export const metadata = { title: "Downloads" };

interface Item {
  title: string;
  description: string;
  icon: React.ReactNode;
  links: { href: string; label: string; icon: React.ReactNode }[];
}

/** Tools and sheets in the firm's house style that planners can send to clients. */
export default async function DownloadsPage() {
  const member = await requireMember();
  const items: Item[] = [
    {
      title: "Uitgavenoverzicht",
      description:
        "Laat de cliënt zelf de uitgaven invullen: vaste lasten, reserveringsuitgaven en huishoudelijke uitgaven. Dezelfde categorieën als bij Uitgaven in het plan, zodat je de subtotalen zo kunt overnemen.",
      icon: <FileSpreadsheet className="h-5 w-5" />,
      links: [
        { href: "/api/downloads/uitgavensheet", label: "Excel (rekent zelf)", icon: <Download className="h-4 w-4" /> },
        { href: "/api/downloads/uitgavenformulier", label: "PDF om te printen", icon: <Printer className="h-4 w-4" /> },
      ],
    },
    {
      title: "Voorbeeldrapport",
      description: "Een volledig rapport met voorbeeldgegevens in jullie huisstijl. Handig om aan een nieuwe cliënt te laten zien wat die krijgt.",
      icon: <FileText className="h-5 w-5" />,
      links: [{ href: "/api/huisstijl/voorbeeld", label: "PDF bekijken", icon: <Download className="h-4 w-4" /> }],
    },
  ];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={member.firm.name}
        title="Downloads"
        subtitle="Hulpmiddelen in de huisstijl van jullie kantoor, om mee te sturen naar cliënten."
      />
      <div className="grid gap-5 md:grid-cols-2">
        {items.map((item) => (
          <Card key={item.title} className="flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-ink-50 text-gold-700">{item.icon}</span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold text-ink-900">{item.title}</h2>
                <p className="mt-1 text-sm text-ink-600">{item.description}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 pt-1">
              {item.links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-ink-200 bg-white px-3 text-[13px] font-semibold text-ink-900 hover:border-ink-400"
                >
                  {l.icon}
                  {l.label}
                </a>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-sm text-ink-500">
        De huisstijl (logo en kleuren) pas je aan bij Instellingen → Huisstijl. Nieuwe hulpmiddelen verschijnen hier vanzelf.
      </p>
    </div>
  );
}
