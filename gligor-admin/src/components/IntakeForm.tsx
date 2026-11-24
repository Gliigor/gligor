"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
import { MONTHS, PACKAGES, SETUP_LABEL } from "@/lib/config";

export interface IntakeDefaults {
  first_name?: string;
  last_name?: string;
  company?: string;
  email?: string | null;
  phone?: string | null;
  address?: string;
  sector?: string | null;
  package?: string;
  users_count?: number | string;
  setup_type?: string | null;
  birthday_day?: number | string | null;
  birthday_month?: number | string | null;
  birthday_consent?: boolean | string;
  pain_points?: string;
  start_date?: string | null;
  referred_by?: string | null;
}

/**
 * Het intakeformulier: één scherm met grote velden, om samen met de klant in te
 * vullen (laptop of tablet). Dezelfde velden staan in de publieke intakelink.
 */
export function IntakeForm({
  action,
  defaults = {},
  hidden = {},
  mode = "admin",
  clients = [],
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  defaults?: IntakeDefaults;
  hidden?: Record<string, string>;
  mode?: "admin" | "public";
  clients?: { id: string; company: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const big = "h-11 text-[15px]";
  const consent = defaults.birthday_consent === true || defaults.birthday_consent === "on" || defaults.birthday_consent === "true";

  return (
    <form action={formAction} className="intake space-y-6">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <section className="grid gap-4 sm:grid-cols-2">
        <Big label="Voornaam *">
          <input name="first_name" required autoComplete="given-name" defaultValue={defaults.first_name ?? ""} className={big} />
        </Big>
        <Big label="Achternaam">
          <input name="last_name" autoComplete="family-name" defaultValue={defaults.last_name ?? ""} className={big} />
        </Big>
        <Big label="Bedrijfsnaam *">
          <input name="company" required autoComplete="organization" defaultValue={defaults.company ?? ""} className={big} />
        </Big>
        <Big label="Sector" hint="Bijvoorbeeld bakkerij, installatiebedrijf of kapsalon">
          <input name="sector" defaultValue={defaults.sector ?? ""} className={big} />
        </Big>
        <Big label="E-mailadres">
          <input name="email" type="email" autoComplete="email" defaultValue={defaults.email ?? ""} className={big} />
        </Big>
        <Big label="Telefoonnummer">
          <input name="phone" type="tel" autoComplete="tel" defaultValue={defaults.phone ?? ""} className={big} />
        </Big>
        <Big label="Bedrijfsadres" hint="Voor facturen (en een kaartje af en toe)" wide>
          <textarea name="address" rows={2} autoComplete="street-address" defaultValue={defaults.address ?? ""} className="text-[15px]" placeholder={"Straat en huisnummer\nPostcode en plaats"} />
        </Big>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Big label="Pakket">
          <select name="package" defaultValue={defaults.package ?? "basis"} className={big}>
            {Object.entries(PACKAGES).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label} · €{v.monthlyFee} per maand
              </option>
            ))}
          </select>
        </Big>
        <Big label="Aantal gebruikers">
          <input name="users_count" type="number" min={0} max={500} defaultValue={String(defaults.users_count ?? 1)} className={big} />
        </Big>
        <Big label="Microsoft 365 of Claude">
          <select name="setup_type" defaultValue={defaults.setup_type ?? ""} className={big}>
            <option value="">Weet ik nog niet</option>
            {Object.entries(SETUP_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Big>
      </section>

      <section className="rounded-lg border border-line bg-bg p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="label block">Verjaardag (optioneel)</span>
            <p className="mt-1 text-[13px] text-muted">Alleen dag en maand: dan stuur ik je een kaartje.</p>
            <div className="mt-2 flex gap-2">
              <select name="birthday_day" defaultValue={String(defaults.birthday_day ?? "")} aria-label="Dag" className={`${big} w-24`}>
                <option value="">Dag</option>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
              <select name="birthday_month" defaultValue={String(defaults.birthday_month ?? "")} aria-label="Maand" className={`${big} flex-1`}>
                <option value="">Maand</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-start gap-3 self-end text-[14px]">
            <input type="checkbox" name="birthday_consent" defaultChecked={consent} className="mt-1 size-4" />
            <span>
              Ja, Gligor mag mijn verjaardag bewaren om me een kaartje en een felicitatie te sturen. Ik kan dit altijd weer laten weghalen.
            </span>
          </label>
        </div>
      </section>

      <Big label="Waar gaat je tijd naartoe?" hint="Welke klusjes kosten je de meeste tijd? Denk aan mails, offertes, planning of social media.">
        <textarea name="pain_points" rows={5} defaultValue={defaults.pain_points ?? ""} className="text-[15px]" />
      </Big>

      {mode === "admin" && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Big label="Startdatum" hint="Hiermee worden het startbedrag en de maandbedragen klaargezet">
            <input name="start_date" type="date" defaultValue={defaults.start_date ?? ""} className={big} />
          </Big>
          <Big label="Aangebracht door" hint="Referral: beide krijgen een gratis maand na 2 betaalde maanden">
            <select name="referred_by" defaultValue={defaults.referred_by ?? ""} className={big}>
              <option value="">Niemand</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </select>
          </Big>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary h-11 px-6 text-[15px]" disabled={pending}>
          {pending ? "Opslaan…" : submitLabel}
        </button>
        {state?.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
        {state?.ok && state.message && <p className="text-sm text-accent" role="status">{state.message}</p>}
      </div>
    </form>
  );
}

function Big({ label, hint, wide, children }: { label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[14px] font-medium">{label}</span>
      {children}
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
    </label>
  );
}
