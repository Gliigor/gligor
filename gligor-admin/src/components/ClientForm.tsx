"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions";
import { CHANNEL_LABEL, PACKAGES, SETUP_LABEL, STAGES, START_FEE, type PackageKey } from "@/lib/config";
import type { ClientRow } from "@/lib/types";
import { Field } from "./ui";

export function ClientForm({
  action,
  client,
  submitLabel,
  showStage = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  client?: ClientRow;
  submitLabel: string;
  showStage?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [pkg, setPkg] = useState<PackageKey>(client?.package ?? "basis");

  return (
    <form action={formAction} className="space-y-5">
      {client && <input type="hidden" name="id" value={client.id} />}
      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="label mb-2">Bedrijf</legend>
        <Field label="Bedrijfsnaam *">
          <input name="company" required defaultValue={client?.company} />
        </Field>
        <Field label="Sector">
          <input name="sector" defaultValue={client?.sector ?? ""} placeholder="Bijv. bakkerij" />
        </Field>
        <Field label="Plaats">
          <input name="city" defaultValue={client?.city ?? ""} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="label mb-2">Contact</legend>
        <Field label="Naam eigenaar">
          <input name="owner_name" defaultValue={client?.owner_name ?? ""} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" defaultValue={client?.email ?? ""} />
        </Field>
        <Field label="Telefoon">
          <input name="phone" type="tel" defaultValue={client?.phone ?? ""} />
        </Field>
        <Field label="Voorkeurskanaal">
          <select name="preferred_channel" defaultValue={client?.preferred_channel ?? "email"}>
            {Object.entries(CHANNEL_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="label mb-2">Pakket en inrichting</legend>
        <Field label="Pakket">
          <select name="package" value={pkg} onChange={(e) => setPkg(e.target.value as PackageKey)}>
            {Object.entries(PACKAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} (€{v.monthlyFee}/mnd)
              </option>
            ))}
          </select>
        </Field>
        <Field label="Maandbedrag (€)" hint="Leeg = standaard van het pakket">
          <input
            name="monthly_fee"
            inputMode="decimal"
            key={pkg}
            defaultValue={client && client.package === pkg ? String(client.monthly_fee) : String(PACKAGES[pkg].monthlyFee)}
          />
        </Field>
        <Field label="Startbedrag (€)">
          <input name="start_fee" inputMode="decimal" defaultValue={String(client?.start_fee ?? START_FEE)} />
        </Field>
        <Field label="Startdatum" hint="Wordt automatisch gezet bij fase Inrichting">
          <input name="start_date" type="date" defaultValue={client?.start_date ?? ""} />
        </Field>
        <Field label="Omgeving">
          <select name="setup_type" defaultValue={client?.setup_type ?? ""}>
            <option value="">Nog niet bekend</option>
            {Object.entries(SETUP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aantal gebruikers">
          <input name="users_count" type="number" min={0} defaultValue={client?.users_count ?? 1} />
        </Field>
        {showStage && (
          <Field label="Fase">
            <select name="stage" defaultValue="lead">
              {STAGES.filter((s) => s.key !== "opgezegd").map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Tags" hint="Gescheiden door komma's">
          <input name="tags" defaultValue={client?.tags.join(", ") ?? ""} placeholder="offertes, social media" />
        </Field>
      </fieldset>

      <Field label="Notities">
        <textarea name="notes" rows={4} defaultValue={client?.notes ?? ""} />
      </Field>

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Opslaan…" : submitLabel}
        </button>
        {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        {state?.ok && state.message && <p className="text-sm text-accent" role="status">{state.message}</p>}
      </div>
    </form>
  );
}
