"use client";

import { useActionState, useState, useTransition } from "react";
import { FormError, FormSuccess, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/components/ui/cn";
import {
  invitePlannerAction,
  revokeInvitationAction,
  setAiReaderAction,
  updateFirmAction,
  type ActionResult,
} from "@/lib/actions/settings";

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

export function AiReaderSwitch({ enabled, available, unavailableReason }: { enabled: boolean; available: boolean; unavailableReason?: string }) {
  const [on, setOn] = useState(enabled);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const disabled = pending || (!available && !on);

  function toggle() {
    const next = !on;
    if (next && !confirm("Documenten van dit kantoor voortaan laten uitlezen door Claude via Amazon Bedrock (EU)?")) return;
    start(async () => {
      const res = await setAiReaderAction(next);
      setResult(res);
      if (res.ok) setOn(next);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div id="ai-reader-label" className="font-medium text-ink-900">
            Documenten automatisch uitlezen
          </div>
          <div className="text-sm text-ink-500">{on ? "Aan voor alle planners van dit kantoor" : "Uit: bij een upload worden alleen voorbeeldwaarden ingevuld"}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="ai-reader-label"
          disabled={disabled}
          onClick={toggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            on ? "bg-gold-500" : "bg-ink-300",
          )}
        >
          <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
        </button>
      </div>
      {!available ? <p className="text-sm text-warn-600">Nog niet beschikbaar. {unavailableReason}</p> : null}
      {result?.error ? <FormError message={result.error} /> : null}
    </div>
  );
}
