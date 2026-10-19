"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { inputClass } from "@/components/ui/form";
import { Trash2 } from "@/components/ui/icons";
import { CASH_KINDS, getCashKind, type CashGroup } from "@/lib/plan/definitions";
import type { CashItem, PlanConfig, PlanInputs } from "@/lib/plan/types";
import { FieldShell, NumberInput } from "../fields";

const domId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");
const newId = () => crypto.randomUUID().slice(0, 18);

const GROUPS: { group: CashGroup; title: string; add: string }[] = [
  { group: "inkomen", title: "Inkomsten", add: "Inkomen toevoegen" },
  { group: "uitgave", title: "Uitgaven", add: "Uitgave toevoegen" },
];

/**
 * Income and expense items with a period (start year, end year, growth), on top
 * of the fixed yearly figures. Kinds are offered only for enabled plan sections.
 */
export function CashItemsCard({
  config,
  inputs,
  missingIds,
  onChange,
}: {
  config: PlanConfig;
  inputs: PlanInputs;
  missingIds: Set<string>;
  onChange: (next: PlanInputs) => void;
}) {
  const hasPartner = config.sections.partner;
  const partnerName = inputs.partner.naam || "Partner";
  const kinds = CASH_KINDS.filter((k) => config.sections[k.section]);
  const items = inputs.posten.filter((x) => {
    const kind = getCashKind(x.soort);
    return kind && config.sections[kind.section];
  });

  const setItem = (id: string, patch: Partial<CashItem>) =>
    onChange({ ...inputs, posten: inputs.posten.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  const add = (soort: string) => {
    const kind = getCashKind(soort);
    if (!kind) return;
    onChange({
      ...inputs,
      posten: [
        ...inputs.posten,
        { id: newId(), soort, persoon: kind.perPerson ? "client" : null, omschrijving: "", bedrag: null, startjaar: null, eindjaar: null, groei: null },
      ],
    });
  };
  const remove = (id: string) => onChange({ ...inputs, posten: inputs.posten.filter((x) => x.id !== id) });

  return (
    <Card>
      <CardHeader
        title="Inkomsten en uitgaven in de tijd"
        description="Posten met een eigen periode, bovenop het vaste inkomen en de vaste uitgaven. Bedragen in geld van nu; zonder groei bewegen ze mee met de inflatie."
      />
      <div className="space-y-6 p-4 sm:p-5">
        {GROUPS.map(({ group, title, add: addLabel }) => {
          const rows = items.filter((x) => getCashKind(x.soort)?.group === group);
          const options = kinds.filter((k) => k.group === group);
          if (options.length === 0) return null;
          return (
            <div key={group} className="space-y-3">
              <h4 className="text-sm font-semibold text-ink-800">{title}</h4>
              {rows.length === 0 ? <p className="text-sm text-ink-500">Geen extra {title.toLowerCase()}.</p> : null}
              {rows.map((x) => {
                const kind = getCashKind(x.soort)!;
                const f = (key: string) => domId(`post.${x.id}.${key}`);
                return (
                  <div key={x.id} className="rounded-sm border border-ink-200 bg-ink-50/50 p-3">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-ink-900">{kind.label}</div>
                        {kind.help ? <p className="text-xs text-ink-500">{kind.help}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(x.id)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-sm px-2 py-1 text-xs text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                        aria-label={`${kind.label} verwijderen`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <FieldShell id={f("omschrijving")} label="Omschrijving">
                        <input
                          id={f("omschrijving")}
                          className={inputClass}
                          value={x.omschrijving}
                          placeholder="Optioneel"
                          onChange={(e) => setItem(x.id, { omschrijving: e.target.value })}
                        />
                      </FieldShell>
                      {kind.perPerson && hasPartner ? (
                        <FieldShell id={f("persoon")} label="Van">
                          <select
                            id={f("persoon")}
                            className={inputClass}
                            value={x.persoon ?? "client"}
                            onChange={(e) => setItem(x.id, { persoon: e.target.value as CashItem["persoon"] })}
                          >
                            <option value="client">Cliënt</option>
                            <option value="partner">{partnerName}</option>
                          </select>
                        </FieldShell>
                      ) : null}
                      <FieldShell
                        id={f("bedrag")}
                        label={kind.oneOff ? "Bedrag" : group === "inkomen" ? "Bruto per jaar" : "Per jaar"}
                        missing={missingIds.has(`post.${x.id}.bedrag`)}
                      >
                        <NumberInput
                          id={f("bedrag")}
                          kind="money"
                          value={x.bedrag}
                          missing={missingIds.has(`post.${x.id}.bedrag`)}
                          onChange={(v) => setItem(x.id, { bedrag: v })}
                        />
                      </FieldShell>
                      <FieldShell id={f("startjaar")} label={kind.oneOff ? "In jaar" : "Vanaf jaar"} missing={missingIds.has(`post.${x.id}.startjaar`)}>
                        <NumberInput
                          id={f("startjaar")}
                          kind="integer"
                          value={x.startjaar}
                          placeholder={kind.defaultStart === "pensioen" ? "Pensioenleeftijd" : "Nu"}
                          missing={missingIds.has(`post.${x.id}.startjaar`)}
                          onChange={(v) => setItem(x.id, { startjaar: v })}
                        />
                      </FieldShell>
                      {!kind.oneOff ? (
                        <>
                          <FieldShell id={f("eindjaar")} label="Tot en met jaar">
                            <NumberInput
                              id={f("eindjaar")}
                              kind="integer"
                              value={x.eindjaar}
                              placeholder="Geen einde"
                              onChange={(v) => setItem(x.id, { eindjaar: v })}
                            />
                          </FieldShell>
                          <FieldShell id={f("groei")} label="Groei per jaar">
                            <NumberInput
                              id={f("groei")}
                              kind="percent"
                              value={x.groei}
                              placeholder="Inflatie"
                              onChange={(v) => setItem(x.id, { groei: v })}
                            />
                          </FieldShell>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <AddMenu label={addLabel} options={options.map((k) => ({ value: k.kind, label: k.label }))} onPick={add} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** A compact "add" picker: a select that resets after each choice. */
export function AddMenu({
  label,
  options,
  onPick,
  disabled,
}: {
  label: string;
  options: { value: string; label: string }[];
  onPick: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      aria-label={label}
      value=""
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value) onPick(e.target.value);
      }}
      className={cn(
        "h-9 cursor-pointer rounded-sm border border-ink-300 bg-white px-3 text-[13px] font-semibold text-ink-800 hover:border-ink-500 focus:outline-none focus:ring-2 focus:ring-gold-500/40",
        disabled && "opacity-50",
      )}
    >
      <option value="">+ {label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
