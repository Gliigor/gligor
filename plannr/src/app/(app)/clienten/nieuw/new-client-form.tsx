"use client";

import { useActionState } from "react";
import { FormError, Hint, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClientAction, type FormState } from "../actions";

export function NewClientForm() {
  const [state, action] = useActionState(createClientAction, {} as FormState);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first_name">Voornaam</Label>
          <Input id="first_name" name="first_name" required autoFocus />
        </div>
        <div>
          <Label htmlFor="last_name">Achternaam</Label>
          <Input id="last_name" name="last_name" required />
        </div>
      </div>
      <div>
        <Label htmlFor="company_name">Bedrijfsnaam (optioneel)</Label>
        <Input id="company_name" name="company_name" />
        <Hint>Bijvoorbeeld de BV van een DGA.</Hint>
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Opslaan…">Cliënt opslaan</SubmitButton>
      </div>
    </form>
  );
}
