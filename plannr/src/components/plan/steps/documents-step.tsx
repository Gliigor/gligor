"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { FormError, FormSuccess } from "@/components/ui/form";
import { FileText, FileUp, Loader2, Trash2 } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { deleteDocument, registerDocument } from "@/lib/actions/documents";
import { formatDateTime } from "@/lib/format";
import { DOCUMENT_TYPE_LABELS, type DocumentRow, type DocumentType } from "@/lib/plan/types";

const ACCEPT = ["application/pdf", "image/png", "image/jpeg"];
const MAX_BYTES = 20 * 1024 * 1024;

function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "_").slice(-100);
}

export function DocumentsStep({
  firmId,
  planId,
  documents,
  priveEnabled,
  zakelijkEnabled,
}: {
  firmId: string;
  planId: string;
  documents: DocumentRow[];
  priveEnabled: boolean;
  zakelijkEnabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-600">
        Upload de meest recente ondertekende stukken. Gevonden waarden worden alleen ingevuld bij de onderdelen die je in
        stap 1 hebt aangevinkt, en gemarkeerd als <Badge tone="doc">uit document</Badge>. Deze stap is optioneel.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <DropZone
          firmId={firmId}
          planId={planId}
          type="ib_aangifte"
          title="IB-aangifte (privé)"
          description="Meest recente ondertekende aangifte inkomstenbelasting"
          disabledNote={priveEnabled ? undefined : "Er zijn geen privé-onderdelen aangevinkt in stap 1."}
          documents={documents.filter((d) => d.type === "ib_aangifte")}
        />
        <DropZone
          firmId={firmId}
          planId={planId}
          type="jaarrekening"
          title="Jaarrekening (zakelijk)"
          description="Meest recente jaarrekening van de BV"
          disabledNote={zakelijkEnabled ? undefined : "Er zijn geen zakelijke onderdelen aangevinkt in stap 1."}
          documents={documents.filter((d) => d.type === "jaarrekening")}
        />
      </div>
    </div>
  );
}

function DropZone({
  firmId,
  planId,
  type,
  title,
  description,
  disabledNote,
  documents,
}: {
  firmId: string;
  planId: string;
  type: DocumentType;
  title: string;
  description: string;
  disabledNote?: string;
  documents: DocumentRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setMessage(null);
    if (!ACCEPT.includes(file.type)) return setError("Alleen PDF-, PNG- of JPG-bestanden zijn toegestaan.");
    if (file.size > MAX_BYTES) return setError("Het bestand is groter dan 20 MB.");

    setBusy(true);
    try {
      const path = `${firmId}/${planId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
      if (uploadError) throw new Error("upload");
      const res = await registerDocument(planId, { type, path, fileName: file.name });
      if (!res.ok) setError(res.error ?? "Er ging iets mis.");
      else {
        setMessage(
          res.appliedCount
            ? `${res.appliedCount} ${res.appliedCount === 1 ? "veld" : "velden"} ingevuld uit het document. ${res.notes?.join(" ") ?? ""}`
            : "Document opgeslagen. Er zijn geen velden ingevuld voor de aangevinkte onderdelen.",
        );
      }
      router.refresh();
    } catch {
      setError("Uploaden is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Dit document verwijderen? Ingevulde waarden blijven staan.")) return;
    await deleteDocument(id);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-3 p-4 sm:p-5">
        {disabledNote ? <p className="text-sm text-warn-600">{disabledNote}</p> : null}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragging ? "border-brand-500 bg-brand-50" : "border-ink-200 bg-ink-50",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
              <p className="text-sm text-ink-600">Uploaden en uitlezen…</p>
            </>
          ) : (
            <>
              <FileUp className="h-7 w-7 text-ink-400" />
              <p className="text-sm text-ink-700">
                <span className="hidden sm:inline">Sleep een bestand hierheen of </span>
                <button type="button" className="font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2" onClick={() => inputRef.current?.click()}>
                  kies een bestand
                </button>
              </p>
              <p className="text-xs text-ink-500">PDF, PNG of JPG · max. 20 MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => void handleFile(e.target.files?.[0])}
            aria-label={`${title} uploaden`}
          />
        </div>
        <FormError message={error} />
        <FormSuccess message={message} />
        {documents.length > 0 ? (
          <ul className="divide-y divide-ink-100 rounded-lg border border-ink-100">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-ink-400" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.file_name}</div>
                  <div className="text-xs text-ink-500">
                    {DOCUMENT_TYPE_LABELS[d.type]}
                    {d.year ? ` ${d.year}` : ""} · {formatDateTime(d.uploaded_at)}
                  </div>
                </div>
                <Badge tone={d.extraction_status === "verwerkt" ? "ok" : d.extraction_status === "mislukt" ? "danger" : "neutral"}>
                  {d.extraction_status === "verwerkt" ? "Uitgelezen" : d.extraction_status === "mislukt" ? "Mislukt" : "Bezig"}
                </Badge>
                <button
                  type="button"
                  onClick={() => void remove(d.id)}
                  className="rounded p-1 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  aria-label={`${d.file_name} verwijderen`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
