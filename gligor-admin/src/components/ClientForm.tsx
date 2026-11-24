"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/app/actions";
import { CHANNEL_LABEL, MONTHS, PACKAGES, SETUP_LABEL, STAGES, START_FEE, type PackageKey } from "@/lib/config";
import type { ClientRow } from "@/lib/types";
import { Field } from "./ui";

export function ClientForm({
  action,
  client,
  submitLabel,
  showStage = false,
  clients = [],
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  client?: ClientRow;
  submitLabel: string;
  showStage?: boolean;
  /** Voor "Aangebracht door". */
  clients?: { id: string; company: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [pkg, setPkg] = useState<PackageKey>(client?.package ?? "basis");
  // Oudere klanten hebben alleen een volledige naam; splits die als startpunt.
  const legacy = client && !client.first_name && client.owner_name ? client.owner_name.trim().split(/\s+/) : null;
  const firstName = client?.first_name || legacy?.[0] || "";
  const lastName = client?.last_name || legacy?.slice(1).join(" ") || "";

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

      <fieldset className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <legend className="label mb-2">Contact</legend>
        <Field label="Voornaam">
          <input name="first_name" defaultValue={firstName} />
        </Field>
        <Field label="Achternaam">
          <input name="last_name" defaultValue={lastName} />
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

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="label mb-2">Adres en persoonlijk</legend>
        <Field label="Bedrijfsadres" hint="Voor facturen en kaartjes">
          <textarea name="address" rows={2} defaultValue={client?.address ?? ""} placeholder={"Straat 1\n1234 AB Plaats"} />
        </Field>
        <Field label="Ander adres voor een kaartje" hint="Leeg = bedrijfsadres">
          <textarea name="card_address" rows={2} defaultValue={client?.card_address ?? ""} />
        </Field>
        <div className="space-y-2">
          <span className="label block">Verjaardag (alleen dag en maand)</span>
          <div className="flex gap-2">
            <select name="birthday_day" defaultValue={String(client?.birthday_day ?? "")} aria-label="Dag" className="w-24">
              <option value="">Dag</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select name="birthday_month" defaultValue={String(client?.birthday_month ?? "")} aria-label="Maand" className="flex-1">
              <option value="">Maand</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-start gap-2 text-[13px]">
            <input type="checkbox" name="birthday_consent" defaultChecked={client?.birthday_consent ?? false} className="mt-0.5" />
            <span>Toestemming om de verjaardag te gebruiken (kaartje en felicitatie). Zonder vinkje wordt de datum niet bewaard.</span>
          </label>
        </div>
        <Field label="Aangebracht door" hint="Referral: beide krijgen een gratis maand na 2 betaalde maanden">
          <select name="referred_by" defaultValue={client?.referred_by ?? ""}>
            <option value="">Niemand</option>
            {clients
              .filter((o) => o.id !== client?.id)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.company}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Cadeau-ideeën" hint="Hobby's, lievelingstraktatie, dingen die ter sprake kwamen">
          <textarea name="gift_ideas" rows={3} defaultValue={client?.gift_ideas ?? ""} className="sm:col-span-2" />
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
