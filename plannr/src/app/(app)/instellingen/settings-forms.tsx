"use client";

import { useActionState, useTransition } from "react";
import { FormError, FormSuccess, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { invitePlannerAction, revokeInvitationAction, updateFirmAction, type ActionResult } from "@/lib/actions/settings";

const initial: ActionResult = { ok: false };

export function FirmForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateFirmAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="firm-name">Naam van het kantoor</Label>
          <Input id="firm-name" name="name" defaultValue={name} required />
        </div>
        <SubmitButton variant="secondary">Opslaan</SubmitButton>
      </div>
      <FormError message={state.error} />
      {state.message ? <p className="text-sm text-ok-600">{state.message}</p> : null}
    </form>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(invitePlannerAction, initial);
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="invite-email">Planner uitnodigen</Label>
          <Input id="invite-email" name="email" type="email" placeholder="naam@kantoor.nl" required />
        </div>
        <SubmitButton pendingText="Uitnodigen…">Uitnodigen</SubmitButton>
      </div>
      <FormError message={state.error} />
      {state.message ? (
        <div className="space-y-2">
          <FormSuccess message={state.message} />
          {state.link ? (
            <Input readOnly value={state.link} onFocus={(e) => e.currentTarget.select()} aria-label="Uitnodigingslink" />
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export function RevokeButton({ invitationId }: { invitationId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void revokeInvitationAction(invitationId))}
      className="text-sm text-ink-500 hover:text-danger-600"
    >
      Intrekken
    </button>
  );
}
