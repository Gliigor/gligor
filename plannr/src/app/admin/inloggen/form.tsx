"use client";

import { useActionState } from "react";
import { FormError, Input, Label } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { adminSignIn } from "../actions";

export function AdminLoginForm() {
  const [state, action] = useActionState(adminSignIn, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="email">E-mailadres</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Wachtwoord</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError message={state.error} />
      <SubmitButton className="w-full">Inloggen</SubmitButton>
    </form>
  );
}
