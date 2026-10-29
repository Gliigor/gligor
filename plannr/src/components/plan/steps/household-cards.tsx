"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { inputClass } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { Plus, Trash2 } from "@/components/ui/icons";
import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import { GIFT_KINDS, PARTNER_FIELDS, PARTNER_INCOME_FIELDS } from "@/lib/plan/definitions";
import type { ChildInput, GiftPlanInput, PlanInputs } from "@/lib/plan/types";
import { formatEuro } from "@/lib/format";
import { FieldInput, FieldShell, NumberInput } from "../fields";

const domId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");
const newId = () => crypto.randomUUID().slice(0, 18);

export function PartnerCard({
  inputs,
  missingIds,
  onChange,
  part = "gezin",
  extra,
}: {
  inputs: PlanInputs;
  missingIds: Set<string>;
  onChange: (next: PlanInputs) => void;
  /** Gezin: who the partner is. Inkomen: the partner's income and pension. */
  part?: "gezin" | "inkomen";
  extra?: (fieldKey: string) => React.ReactNode;
}) {
  const fields = PARTNER_FIELDS.filter((f) => PARTNER_INCOME_FIELDS.includes(f.key) === (part === "inkomen"));
  const name = inputs.partner.naam || "partner";
  return (
    <Card>
      <CardHeader
        title={part === "inkomen" ? `Inkomen ${name}` : "Partner"}
        description={part === "inkomen" ? "Bruto per jaar, zoals op de jaaropgaaf." : "Wie de partner is. Inkomen en pensioen vul je in bij Inkomen."}
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
        {fields.map((field) => {
          const id = `partner.${field.key}`;
          return (
            <div key={field.key}>
              <FieldInput
                id={domId(id)}
                field={field}
                value={inputs.partner[field.key as keyof typeof inputs.partner] ?? null}
                missing={missingIds.has(id)}
                fromDocument={inputs.fromDocument.includes(id)}
                onChange={(v) =>
                  onChange({
                    ...inputs,
                    partner: { ...inputs.partner, [field.key]: v },
                    fromDocument: inputs.fromDocument.filter((k) => k !== id),
                  })
                }
              />
              {extra?.(field.key)}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function ChildrenCard({
  inputs,
  missingIds,
  referenceYear,
  onChange,
}: {
  inputs: PlanInputs;
  missingIds: Set<string>;
  referenceYear: number;
  onChange: (next: PlanInputs) => void;
}) {
  const setChild = (id: string, patch: Partial<ChildInput>) =>
    onChange({ ...inputs, kinderen: inputs.kinderen.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  const setGift = (id: string, patch: Partial<GiftPlanInput>) =>
    onChange({ ...inputs, schenkingen: inputs.schenkingen.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  return (
    <Card>
      <CardHeader
        title="Kinderen & schenkingen"
        description={`Ouders mogen een kind jaarlijks ${formatEuro(ASSUMPTIONS.schenking.vrijstellingKind, { whole: true })} belastingvrij schenken; eenmalig ${formatEuro(ASSUMPTIONS.schenking.eenmaligVerhoogd, { whole: true })} als het kind 18 tot 40 jaar is.`}
      />
      <div className="space-y-4 p-5 sm:p-6">
        {inputs.kinderen.length === 0 ? <p className="text-sm text-ink-500">Nog geen kinderen toegevoegd.</p> : null}
        {inputs.kinderen.map((child) => {
          const gifts = inputs.schenkingen.filter((g) => g.kindId === child.id);
          const age = child.geboortejaar ? referenceYear - child.geboortejaar : null;
          return (
            <div key={child.id} className="rounded-sm border border-ink-200 bg-ink-50/50 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                <FieldShell id={domId(`kind.${child.id}.naam`)} label="Naam" missing={missingIds.has(`kind.${child.id}.naam`)}>
                  <input
                    id={domId(`kind.${child.id}.naam`)}
                    className={cn(inputClass, missingIds.has(`kind.${child.id}.naam`) && "border-warn-600 bg-warn-50")}
                    value={child.naam}
                    onChange={(e) => setChild(child.id, { naam: e.target.value })}
                  />
                </FieldShell>
                <FieldShell
                  id={domId(`kind.${child.id}.geboortejaar`)}
                  label={age !== null ? `Geboortejaar (${age} jaar)` : "Geboortejaar"}
                  missing={missingIds.has(`kind.${child.id}.geboortejaar`)}
                >
                  <NumberInput
                    id={domId(`kind.${child.id}.geboortejaar`)}
                    kind="integer"
                    value={child.geboortejaar}
                    missing={missingIds.has(`kind.${child.id}.geboortejaar`)}
                    onChange={(v) => setChild(child.id, { geboortejaar: v })}
                  />
                </FieldShell>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(`${child.naam || "Dit kind"} en de bijbehorende schenkingen verwijderen?`)) return;
                    onChange({
                      ...inputs,
                      kinderen: inputs.kinderen.filter((k) => k.id !== child.id),
                      schenkingen: inputs.schenkingen.filter((g) => g.kindId !== child.id),
                    });
                  }}
                  className="inline-flex h-10 items-center gap-1 self-end rounded-sm px-2 text-xs text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {gifts.map((g) => {
                  const exemption = g.soort === "eenmalig_verhoogd" ? ASSUMPTIONS.schenking.eenmaligVerhoogd : ASSUMPTIONS.schenking.vrijstellingKind;
                  const over = g.bedrag !== null && g.bedrag > exemption;
                  return (
                    <div key={g.id} className="rounded-sm border border-ink-200 bg-white p-3">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <FieldShell id={domId(`gift.${g.id}.soort`)} label="Soort schenking">
                          <select
                            id={domId(`gift.${g.id}.soort`)}
                            className={inputClass}
                            value={g.soort}
                            onChange={(e) => setGift(g.id, { soort: e.target.value as GiftPlanInput["soort"] })}
                          >
                            {GIFT_KINDS.map((k) => (
                              <option key={k.value} value={k.value}>
                                {k.label}
                              </option>
                            ))}
                          </select>
                        </FieldShell>
                        <FieldShell
                          id={domId(`gift.${g.id}.bedrag`)}
                          label={g.soort === "jaarlijks" ? "Bedrag per jaar" : "Bedrag"}
                          missing={missingIds.has(`gift.${g.id}.bedrag`)}
                        >
                          <NumberInput
                            id={domId(`gift.${g.id}.bedrag`)}
                            kind="money"
                            value={g.bedrag}
                            missing={missingIds.has(`gift.${g.id}.bedrag`)}
                            onChange={(v) => setGift(g.id, { bedrag: v })}
                          />
                        </FieldShell>
                        <FieldShell id={domId(`gift.${g.id}.startjaar`)} label="Vanaf jaar" missing={missingIds.has(`gift.${g.id}.startjaar`)}>
                          <NumberInput
                            id={domId(`gift.${g.id}.startjaar`)}
                            kind="integer"
                            value={g.startjaar}
                            missing={missingIds.has(`gift.${g.id}.startjaar`)}
                            onChange={(v) => setGift(g.id, { startjaar: v })}
                          />
                        </FieldShell>
                        {g.soort === "jaarlijks" ? (
                          <FieldShell id={domId(`gift.${g.id}.jaren`)} label="Aantal jaren" missing={missingIds.has(`gift.${g.id}.jaren`)}>
                            <NumberInput
                              id={domId(`gift.${g.id}.jaren`)}
                              kind="integer"
                              value={g.jaren}
                              missing={missingIds.has(`gift.${g.id}.jaren`)}
                              onChange={(v) => setGift(g.id, { jaren: v })}
                            />
                          </FieldShell>
                        ) : (
                          <div className="self-end pb-2 text-xs text-ink-500">Eén keer, in het gekozen jaar.</div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className={over ? "text-warn-600" : "text-ink-500"}>
                          Vrijstelling {formatEuro(exemption, { whole: true })}
                          {over && g.bedrag !== null ? ` · ${formatEuro(g.bedrag - exemption, { whole: true })} is belast met schenkbelasting` : " · belastingvrij"}
                        </span>
                        <button
                          type="button"
                          onClick={() => onChange({ ...inputs, schenkingen: inputs.schenkingen.filter((x) => x.id !== g.id) })}
                          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                        </button>
                      </div>
                    </div>
                  );
                })}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...inputs,
                      schenkingen: [
                        ...inputs.schenkingen,
                        {
                          id: newId(),
                          kindId: child.id,
                          soort: "jaarlijks",
                          bedrag: ASSUMPTIONS.schenking.vrijstellingKind,
                          startjaar: referenceYear,
                          jaren: 5,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Schenking toevoegen
                </Button>
              </div>
            </div>
          );
        })}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onChange({ ...inputs, kinderen: [...inputs.kinderen, { id: newId(), naam: "", geboortejaar: null }] })}
        >
          <Plus className="h-4 w-4" /> Kind toevoegen
        </Button>
      </div>
    </Card>
  );
}
