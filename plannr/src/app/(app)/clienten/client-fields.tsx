"use client";

import { useState } from "react";
import { Hint, Input, Label } from "@/components/ui/form";

/** Fields of a client, shared by the new-client form and "Gegevens wijzigen". */
export function ClientFields({
  initial,
  autoFocus = false,
}: {
  initial?: { first_name: string; last_name: string; company_name: string | null; geboortejaar?: number | null; heeft_bedrijf?: boolean };
  autoFocus?: boolean;
}) {
  const [year, setYear] = useState(initial?.geboortejaar ? String(initial.geboortejaar) : "");
  const [hasCompany, setHasCompany] = useState(initial?.heeft_bedrijf ?? Boolean(initial?.company_name));
  const thisYear = new Date().getFullYear();
  const age = /^\d{4}$/.test(year) && Number(year) <= thisYear ? thisYear - Number(year) : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="first_name">Voornaam</Label>
          <Input id="first_name" name="first_name" defaultValue={initial?.first_name} required autoFocus={autoFocus} />
        </div>
        <div>
          <Label htmlFor="last_name">Achternaam</Label>
          <Input id="last_name" name="last_name" defaultValue={initial?.last_name} required />
        </div>
      </div>
      <div className="max-w-[14rem]">
        <Label htmlFor="geboortejaar">Geboortejaar</Label>
        <Input
          id="geboortejaar"
          name="geboortejaar"
          inputMode="numeric"
          maxLength={4}
          placeholder="Bijv. 1968"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
        />
        <Hint>{age !== null ? `${age} jaar (dit jaar)` : "De leeftijd wordt hieruit berekend."}</Hint>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-ink-700">
        <input
          type="checkbox"
          name="heeft_bedrijf"
          className="mt-0.5 h-4 w-4 accent-gold-500"
          checked={hasCompany}
          onChange={(e) => setHasCompany(e.target.checked)}
        />
        <span>
          <span className="font-medium text-ink-900">Heeft ook een bedrijf</span>
          <span className="block text-xs text-ink-500">Een BV of eenmanszaak. Alleen dan komt de stap Zakelijk in het plan.</span>
        </span>
      </label>
      {hasCompany ? (
        <div>
          <Label htmlFor="company_name">Bedrijfsnaam</Label>
          <Input id="company_name" name="company_name" defaultValue={initial?.company_name ?? ""} placeholder="Bijv. De Vries Holding B.V." />
        </div>
      ) : null}
    </>
  );
}
