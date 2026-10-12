"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form";
import { Download, Loader2 } from "@/components/ui/icons";
import { updateReportSections } from "@/lib/actions/plan";
import { REPORT_SECTIONS, type ReportSectionKey } from "@/lib/plan/definitions";
import { formatDateTime } from "@/lib/format";
import { SaveIndicator, useAutosave } from "../use-autosave";

export function ReportStep({
  planId,
  initialSections,
  exports,
}: {
  planId: string;
  initialSections: ReportSectionKey[];
  exports: { id: string; created_at: string }[];
}) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [previewSections, setPreviewSections] = useState(initialSections);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { status, schedule } = useAutosave(300);

  // Debounce the preview so ticking several boxes renders one PDF.
  useEffect(() => {
    const t = setTimeout(() => setPreviewSections(sections), 700);
    return () => clearTimeout(t);
  }, [sections]);

  function toggle(key: ReportSectionKey, on: boolean) {
    const next = REPORT_SECTIONS.map((r) => r.key).filter((k) => (k === key ? on : sections.includes(k)));
    setSections(next);
    schedule("sections", () => updateReportSections(planId, next));
  }

  async function exportPdf() {
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/plannen/${planId}/rapport`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Exporteren is mislukt.");
      const a = document.createElement("a");
      a.href = json.url;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage("Het rapport is geëxporteerd en opgeslagen in de historie van de cliënt.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Exporteren is mislukt.");
    } finally {
      setExporting(false);
    }
  }

  const previewUrl = `/api/plannen/${planId}/rapport?secties=${previewSections.join(",")}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Rapportonderdelen" description="Wat de cliënt te zien krijgt" />
          <div className="space-y-1 p-3">
            {REPORT_SECTIONS.map((r) => (
              <label key={r.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-ink-50">
                <input
                  type="checkbox"
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                  checked={sections.includes(r.key)}
                  onChange={(e) => toggle(r.key, e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">{r.label}</span>
                  <span className="block text-xs text-ink-500">{r.description}</span>
                </span>
              </label>
            ))}
          </div>
          <div className="border-t border-ink-100 px-4 py-2">
            <SaveIndicator status={status} />
          </div>
        </Card>

        <div className="space-y-3">
          <Button className="w-full" onClick={() => void exportPdf()} disabled={exporting || sections.length === 0}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {exporting ? "PDF maken…" : "Exporteer PDF"}
          </Button>
          <p className="text-xs text-ink-500">
            Elke export is een momentopname. Het plan blijft daarna gewoon bewerkbaar en je kunt zo vaak exporteren als je wilt.
          </p>
          <FormError message={error} />
          <FormSuccess message={message} />
        </div>

        {exports.length > 0 ? (
          <Card>
            <CardHeader title="Eerdere exports van dit plan" />
            <ul className="divide-y divide-ink-100">
              {exports.map((e) => (
                <li key={e.id}>
                  <a href={`/api/exports/${e.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-ink-50">
                    <span className="tabular">{formatDateTime(e.created_at)}</span>
                    <Download className="h-4 w-4 text-brand-600" />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Voorbeeld"
          description="In de huisstijl van je kantoor"
          action={
            <a href={previewUrl} target="_blank" rel="noopener" className="text-sm font-medium text-brand-600 hover:underline">
              Open in nieuw tabblad
            </a>
          }
        />
        {previewSections.length === 0 ? (
          <p className="p-6 text-sm text-ink-500">Kies minimaal één rapportonderdeel.</p>
        ) : (
          <iframe key={previewUrl} src={previewUrl} title="Voorbeeld van het rapport" className="h-[70vh] min-h-[480px] w-full bg-ink-100" />
        )}
      </Card>
    </div>
  );
}
