"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/actions";

/** Verzendknop die zichzelf uitschakelt tijdens het opslaan. */
export function Submit({ children, className = "btn", pendingLabel, name, value, title }: {
  children: ReactNode;
  className?: string;
  pendingLabel?: string;
  name?: string;
  value?: string;
  title?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value} title={title}>
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Formulier met een server action die een melding of fout teruggeeft. */
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm text-danger" role="alert">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-2 text-sm text-accent" role="status">{state.message}</p>}
    </form>
  );
}

/** Kleine "weet je het zeker?"-knop voor gewone server actions. */
export function ConfirmSubmit({ children, message, className = "btn btn-danger btn-sm" }: { children: ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
