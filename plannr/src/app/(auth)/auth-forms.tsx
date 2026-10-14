"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormError, FormSuccess, Hint, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { setPassword, signIn, signUp, type AuthState } from "./actions";

const initial: AuthState = {};

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/clienten"} />
      <FormSuccess message={notice} />
      <div>
        <Label htmlFor="email">E-mailadres</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Inloggen…">
        Inloggen
      </SubmitButton>
    </form>
  );
}

export function RegisterForm({ invitedEmail }: { invitedEmail?: string }) {
  const [state, action] = useActionState(signUp, initial);
  const invited = Boolean(invitedEmail);
  if (state.message) return <FormSuccess message={state.message} />;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invited" value={invited ? "1" : "0"} />
      <div>
        <Label htmlFor="name">Je naam</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={invitedEmail}
          readOnly={invited}
          required
        />
        {invited ? <Hint>Gebruik het e-mailadres waarop je bent uitgenodigd.</Hint> : null}
      </div>
      {!invited ? (
        <div>
          <Label htmlFor="firm_name">Naam van je kantoor</Label>
          <Input id="firm_name" name="firm_name" autoComplete="organization" required />
          <Hint>Je wordt eigenaar van dit kantoor en kunt daarna collega&apos;s uitnodigen.</Hint>
        </div>
      ) : null}
      <div>
        <Label htmlFor="password">Wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Hint>Minimaal 8 tekens.</Hint>
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Account aanmaken…">
        Account aanmaken
      </SubmitButton>
      <p className="text-center text-sm text-ink-500">
        Al een account?{" "}
        <Link href="/inloggen" className="font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2">
          Inloggen
        </Link>
      </p>
    </form>
  );
}

export function SetPasswordForm() {
  const [state, action] = useActionState(setPassword, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="name">Je naam</Label>
        <Input id="name" name="name" autoComplete="name" />
      </div>
      <div>
        <Label htmlFor="password">Nieuw wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <Hint>Minimaal 8 tekens.</Hint>
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full" pendingText="Opslaan…">
        Wachtwoord opslaan
      </SubmitButton>
    </form>
  );
}
