"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import type { ClientRow } from "@/lib/plan/types";
import { deleteClientAction, updateClientAction, type FormState } from "../actions";
import { ClientFields } from "../client-fields";

export function ClientSettings({ client, canDelete }: { client: ClientRow; canDelete: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(
    async (prev: FormState, fd: FormData) => {
      const res = await updateClientAction(client.id, prev, fd);
      if (!res.error) setOpen(false);
      return res;
    },
    {} as FormState,
  );
  const [deleting, startDelete] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Gegevens wijzigen
      </Button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-ink-200 bg-white p-4 shadow-sm sm:max-w-md">
      <form action={action} className="space-y-4">
        <ClientFields initial={client} />
        <FormError message={state.error} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {canDelete ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleting}
              onClick={() => {
                if (confirm("Weet je het zeker? Alle plannen, documenten, notities en rapporten van deze cliënt worden definitief verwijderd.")) {
                  startDelete(() => deleteClientAction(client.id));
                }
              }}
            >
              {deleting ? "Verwijderen…" : "Cliënt verwijderen"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton size="sm">Opslaan</SubmitButton>
          </div>
        </div>
      </form>
    </div>
  );
}
