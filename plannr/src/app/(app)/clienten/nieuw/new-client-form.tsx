"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClientAction, type FormState } from "../actions";
import { ClientFields } from "../client-fields";

export function NewClientForm() {
  const [state, action] = useActionState(createClientAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <ClientFields autoFocus />
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Opslaan…">Cliënt opslaan</SubmitButton>
      </div>
    </form>
  );
}
