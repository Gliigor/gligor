"use client";

import { useActionState } from "react";
import { FormError, Hint, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { createPlanAction } from "@/lib/actions/plan";

export function NewPlanForm({ clientId, suggestion }: { clientId: string; suggestion: string }) {
  const [state, action] = useActionState(createPlanAction.bind(null, clientId), {} as { error?: string });
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="title">Titel</Label>
        <Input id="title" name="title" defaultValue={suggestion} required autoFocus />
        <Hint>Bijvoorbeeld &quot;Plan 2026&quot; of &quot;Wat-als: eerder stoppen&quot;.</Hint>
      </div>
      <FormError message={state?.error} />
      <div className="flex justify-end">
        <SubmitButton pendingText="Aanmaken…">Plan aanmaken</SubmitButton>
      </div>
    </form>
  );
}
