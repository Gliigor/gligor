"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, null);
  if (state?.sent) {
    return (
      <p className="text-[13px] leading-relaxed text-muted" role="status">
        Als dit adres toegang heeft, staat er nu een inloglink in je mailbox. De link is kort geldig en werkt één keer.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">E-mailadres</span>
        <input type="email" name="email" required autoComplete="email" autoFocus />
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Versturen…" : "Stuur inloglink"}
      </button>
    </form>
  );
}
