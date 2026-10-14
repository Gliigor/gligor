"use client";

import { useActionState, useRef, useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormError, Textarea } from "@/components/ui/form";
import { Pencil, Trash2 } from "@/components/ui/icons";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/format";
import { addNoteAction, deleteNoteAction, updateNoteAction, type FormState } from "../actions";

export interface NoteItem {
  id: string;
  content: string;
  createdAt: string;
  edited: boolean;
  authorName: string;
  canEdit: boolean;
}

export function Notes({ clientId, notes }: { clientId: string; notes: NoteItem[] }) {
  const [state, action, pending] = useActionState(addNoteAction.bind(null, clientId), {} as FormState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) formRef.current?.reset();
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <Card className="h-fit">
      <CardHeader title="Notities" description="Memo's over deze cliënt" />
      <div className="space-y-4 p-4 sm:p-5">
        <form ref={formRef} action={action} className="space-y-2">
          <Textarea name="content" placeholder="Nieuwe notitie…" rows={3} aria-label="Nieuwe notitie" />
          <FormError message={state.error} />
          <div className="flex justify-end">
            <SubmitButton size="sm" pendingText="Opslaan…">
              Notitie toevoegen
            </SubmitButton>
          </div>
        </form>
        {notes.length === 0 ? (
          <p className="text-sm text-ink-500">Nog geen notities.</p>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} clientId={clientId} />
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function NoteCard({ note, clientId }: { note: NoteItem; clientId: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.content);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateNoteAction(note.id, clientId, draft);
      setError(res.error);
      if (!res.error) setEditing(false);
    });
  }

  function remove() {
    if (!confirm("Deze notitie verwijderen?")) return;
    startTransition(async () => {
      const res = await deleteNoteAction(note.id, clientId);
      setError(res.error);
    });
  }

  return (
    <li className="rounded-lg border border-ink-100 bg-ink-50/60 p-3">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-ink-500">
        <span className="truncate">
          <span className="font-medium text-ink-700">{note.authorName}</span> · {formatDateTime(note.createdAt)}
          {note.edited ? " · bewerkt" : ""}
        </span>
        {note.canEdit && !editing ? (
          <span className="flex shrink-0 gap-1">
            <button type="button" onClick={() => setEditing(true)} className="rounded p-1 hover:bg-ink-100" aria-label="Notitie bewerken">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={remove} disabled={pending} className="rounded p-1 hover:bg-danger-50 hover:text-danger-600" aria-label="Notitie verwijderen">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </span>
        ) : null}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} aria-label="Notitie" />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(note.content); }}>
              Annuleren
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-ink-800">{note.content}</p>
      )}
      <FormError message={error} />
    </li>
  );
}
