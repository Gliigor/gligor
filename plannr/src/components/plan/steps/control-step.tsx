"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { AlertTriangle, Check, FileText, Plus, Trash2 } from "@/components/ui/icons";
import { addAsset, deleteAsset, setPlanSections, updateAsset, updatePlanInputs } from "@/lib/actions/plan";
import {
  ASSET_TYPES,
  getAssetType,
  OWNER_OPTIONS,
  PRIVE_FIELD_STEP,
  PRIVE_INPUT_FIELDS,
  SECTIONS,
  stepOfAssetType,
  type AssetTypeDef,
  type FieldDef,
  type PrivePart,
  type SectionKey,
  type Side,
  type StepKey,
} from "@/lib/plan/definitions";
import { findMissingFields, isAssetTypeRelevant, isFieldVisible } from "@/lib/plan/status";
import type { AssetRow, PlanConfig, PlanInputs, ReturnPercents } from "@/lib/plan/types";
import { formatEuro } from "@/lib/format";
import { FieldInput, FieldShell, NumberInput } from "../fields";
import { ownerOf } from "@/lib/plan/to-engine-input";
import { inputClass } from "@/components/ui/form";
import { ChildrenCard, PartnerCard } from "./household-cards";
import { AddMenu, CashItemsCard } from "./cash-items-card";
import { AssumptionsCard } from "./assumptions-card";
import { ExpensesCard } from "./expenses-card";
import { SalaryHelper } from "./salary-helper";
import { deriveBv, isExtended } from "@/lib/plan/bv";
import { taxableBusinessProfit } from "@/lib/engine/mock-engine";
import { SaveIndicator, useAutosave } from "../use-autosave";

const domId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");

export function ControlStep({
  part,
  planId,
  config: initialConfig,
  initialInputs,
  initialAssets,
  firmReturns,
}: {
  part: PrivePart | "zakelijk";
  planId: string;
  config: PlanConfig;
  initialInputs: PlanInputs;
  initialAssets: AssetRow[];
  firmReturns?: ReturnPercents | null;
}) {
  const side: Side = part === "zakelijk" ? "zakelijk" : "prive";
  const router = useRouter();
  const [config, setConfig] = useState(initialConfig);
  const [toggling, setToggling] = useState(false);
  const [inputs, setInputs] = useState(initialInputs);
  const [assets, setAssets] = useState(initialAssets);
  const [adding, setAdding] = useState<string | null>(null);
  const { status, schedule } = useAutosave();

  const missing = useMemo(
    () => findMissingFields(config, inputs, assets).filter((m) => m.step === part),
    [config, inputs, assets, part],
  );
  const missingIds = useMemo(() => new Set(missing.map((m) => m.id)), [missing]);

  const sideAssets = assets.filter((a) => a.side === side);
  const partAssets = sideAssets.filter((a) => {
    const def = getAssetType(a.type);
    return def ? stepOfAssetType(def) === part : false;
  });
  const docCount =
    (side === "prive"
      ? inputs.fromDocument.filter((k) => (k.startsWith("partner.") ? part === "gezin" : PRIVE_FIELD_STEP[k] === part)).length
      : 0) + partAssets.reduce((n, a) => n + (a.metadata._fromDocument?.length ?? 0), 0);

  /** Switches plan sections. Rows the server adds (e.g. the eigen woning) are merged in; nothing typed is lost. */
  async function toggleSections(patch: Partial<Record<SectionKey, boolean>>) {
    setConfig((c) => ({ ...c, sections: { ...c.sections, ...patch } }));
    setToggling(true);
    try {
      const res = await setPlanSections(planId, patch);
      if (res.ok && res.assets) {
        const added = res.assets;
        setAssets((rows) => [...rows, ...added.filter((a) => !rows.some((r) => r.id === a.id))]);
      }
    } finally {
      setToggling(false);
    }
    router.refresh();
  }

  // --- mutations ---------------------------------------------------------------
  function saveInputs(next: PlanInputs) {
    setInputs(next);
    schedule("inputs", () => updatePlanInputs(planId, next));
  }

  function setInput(key: string, value: number | string | null) {
    saveInputs({
      ...inputs,
      prive: { ...inputs.prive, [key]: value },
      fromDocument: inputs.fromDocument.filter((k) => k !== key),
    });
  }

  function patchAsset(id: string, patch: { label?: string; value?: number | null; meta?: [string, unknown] }) {
    const row = assets.find((r) => r.id === id);
    if (!row) return;
    const changedKey = patch.meta ? patch.meta[0] : patch.value !== undefined ? "value" : null;
    const metadata = { ...row.metadata };
    if (patch.meta) metadata[patch.meta[0]] = patch.meta[1];
    if (changedKey) metadata._fromDocument = (metadata._fromDocument ?? []).filter((k) => k !== changedKey);
    const updated: AssetRow = {
      ...row,
      label: patch.label ?? row.label,
      value: patch.value !== undefined ? patch.value : row.value,
      metadata,
    };
    setAssets((rows) => rows.map((r) => (r.id === id ? updated : r)));
    schedule(`asset:${id}`, () => updateAsset(id, { label: updated.label, value: updated.value, metadata: updated.metadata }));
  }

  async function addRow(type: string) {
    setAdding(type);
    const res = await addAsset(planId, type);
    setAdding(null);
    if (res.ok && res.asset) setAssets((rows) => [...rows, res.asset!]);
  }

  function removeRow(id: string) {
    if (!confirm("Deze regel verwijderen?")) return;
    setAssets((rows) => rows.filter((r) => r.id !== id));
    schedule(`asset:${id}`, () => deleteAsset(id), true);
  }

  // --- rendering -----------------------------------------------------------------
  const ownerSelect = (row: AssetRow, bv = false, label?: string) =>
    config.sections.partner ? (
      <FieldShell id={domId(`asset.${row.id}.eigenaar`)} label={label ?? (bv ? "Aandelen van" : "Eigenaar")}>
        <select
          id={domId(`asset.${row.id}.eigenaar`)}
          className={inputClass}
          value={ownerOf(row)}
          onChange={(e) => patchAsset(row.id, { meta: ["eigenaar", e.target.value] })}
        >
          {OWNER_OPTIONS.filter((o) => !bv || o.value !== "joint").map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === "partner" && inputs.partner.naam ? inputs.partner.naam : o.label}
            </option>
          ))}
        </select>
      </FieldShell>
    ) : null;

  const inputField = (field: FieldDef) => {
    const id = `input.${field.key}`;
    return (
      <FieldInput
        key={field.key}
        id={domId(id)}
        field={field}
        value={inputs.prive[field.key as keyof typeof inputs.prive] ?? null}
        onChange={(v) => setInput(field.key, v)}
        missing={missingIds.has(id)}
        fromDocument={inputs.fromDocument.includes(field.key)}
      />
    );
  };

  const metaField = (row: AssetRow, field: FieldDef) => {
    const id = `asset.${row.id}.${field.key}`;
    return (
      <FieldInput
        key={field.key}
        id={domId(id)}
        field={field}
        // A BV without a stated holder is held directly.
        value={row.metadata[field.key] ?? (field.key === "gehouden_door" ? "dga" : null)}
        onChange={(v) => patchAsset(row.id, { meta: [field.key, v] })}
        missing={missingIds.has(id)}
        fromDocument={row.metadata._fromDocument?.includes(field.key)}
      />
    );
  };

  const assetBlock = (def: AssetTypeDef, section: SectionKey) => {
    const rows = assets.filter((a) => a.type === def.type);
    const typeMissing = missingIds.has(`type.${def.type}`);
    const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
    return (
      <div key={def.type} id={`veld-${domId(`type.${def.type}`)}`} className="scroll-mt-28 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-800">
            {def.label}
            {def.kind === "schuld" ? <Badge>schuld</Badge> : null}
            {typeMissing ? <Badge tone="warn">Ontbreekt</Badge> : null}
          </h4>
          {rows.length > 1 && def.valueField ? (
            <span className="text-xs text-ink-500 tabular">Totaal {formatEuro(total)}</span>
          ) : null}
        </div>
        {rows.length === 0 ? (
          <p className={cn("text-sm", typeMissing ? "text-warn-600" : "text-ink-500")}>Nog niets ingevuld.</p>
        ) : null}
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-ink-100 bg-ink-50/50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {def.showLabel ? (
                <FieldShell id={domId(`asset.${row.id}.label`)} label={`Omschrijving ${def.itemLabel.toLowerCase()}`}>
                  <input
                    id={domId(`asset.${row.id}.label`)}
                    className="block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-[15px] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                    value={row.label}
                    placeholder="Optioneel"
                    onChange={(e) => patchAsset(row.id, { label: e.target.value })}
                  />
                </FieldShell>
              ) : null}
              {def.valueField ? (
                <FieldShell
                  id={domId(`asset.${row.id}.value`)}
                  label={def.valueField.label}
                  help={def.valueField.help}
                  missing={missingIds.has(`asset.${row.id}.value`)}
                  fromDocument={row.metadata._fromDocument?.includes("value")}
                >
                  <NumberInput
                    id={domId(`asset.${row.id}.value`)}
                    kind="money"
                    value={row.value}
                    onChange={(v) => patchAsset(row.id, { value: v })}
                    missing={missingIds.has(`asset.${row.id}.value`)}
                    fromDocument={row.metadata._fromDocument?.includes("value")}
                  />
                </FieldShell>
              ) : null}
              {def.metadataFields
                .filter((f) => (f.section === section || f.section === "algemeen") && isFieldVisible(f, config))
                .map((f) => metaField(row, f))}
              {def.side === "prive" && def.type !== "hypotheek" ? ownerSelect(row) : null}
              {def.type === "eenmanszaak" ? ownerSelect(row, true, "Ondernemer") : null}
            </div>
            {def.multiple ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-ink-500 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Verwijderen
                </button>
              </div>
            ) : null}
          </div>
        ))}
        {def.multiple || rows.length === 0 ? (
          <Button variant="secondary" size="sm" onClick={() => void addRow(def.type)} disabled={adding === def.type}>
            <Plus className="h-4 w-4" /> {def.itemLabel} toevoegen
          </Button>
        ) : null}
      </div>
    );
  };

  /** One card for a privé topic: its fields, its core rows and the optional topics that belong to this step. */
  const priveCard = (title: string, description: string, opts: { fields?: FieldDef[]; section: SectionKey; types?: AssetTypeDef[] }) => {
    const types = opts.types ?? [];
    const core = types.filter((t) => !t.optional);
    const optional = types.filter((t) => t.optional);
    const shown = optional.filter((t) => assets.some((a) => a.type === t.type));
    const fields = opts.fields ?? [];
    return (
      <Card key={title}>
        <CardHeader title={title} description={description} />
        <div className="space-y-5 p-4 sm:p-5">
          {fields.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.key}>
                  {inputField(f)}
                  {f.key === "bruto_inkomen" ? <SalaryHelper idPrefix="client" onApply={(v) => setInput("bruto_inkomen", v)} /> : null}
                </div>
              ))}
            </div>
          ) : null}
          {core.map((t) => assetBlock(t, t.sections.find((k) => config.sections[k]) ?? opts.section))}
          {shown.map((t) => assetBlock(t, t.sections.find((k) => config.sections[k]) ?? opts.section))}
          {optional.length > 0 ? (
            <div className="border-t border-ink-100 pt-4">
              <AddMenu
                label="Onderwerp toevoegen"
                options={optional.map((t) => ({ value: t.type, label: `${t.label}: ${t.description}` }))}
                onPick={(type) => void addRow(type)}
                disabled={adding !== null}
              />
            </div>
          ) : null}
        </div>
      </Card>
    );
  };

  const fieldsOf = (step: PrivePart, section?: SectionKey) =>
    PRIVE_INPUT_FIELDS.filter((f) => PRIVE_FIELD_STEP[f.key] === step && (!section || f.section === section) && isFieldVisible(f, config));
  const typesOf = (step: StepKey) =>
    ASSET_TYPES.filter((t) => t.side === side && stepOfAssetType(t) === step && isAssetTypeRelevant(t, config));

  const yesNo = (label: string, help: string, value: boolean, onChange: (v: boolean) => void, id: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-900" id={`${id}-label`}>
          {label}
        </div>
        <div className="text-xs text-ink-500">{help}</div>
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex overflow-hidden rounded-sm border border-ink-200">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={toggling}
            onClick={() => value !== v && onChange(v)}
            className={cn(
              "h-9 px-4 text-[13px] font-semibold",
              value === v ? "bg-night text-white" : "bg-white text-ink-700 hover:bg-ink-50",
            )}
          >
            {v ? "Ja" : "Nee"}
          </button>
        ))}
      </div>
    </div>
  );

  const derivedField = (row: AssetRow, field: FieldDef, value: number) => (
    <FieldShell key={field.key} id={domId(`asset.${row.id}.${field.key}`)} label={field.label}>
      <div
        id={domId(`asset.${row.id}.${field.key}`)}
        className="flex h-10 items-center justify-between rounded-sm border border-ink-200 bg-ink-50 px-3 text-[15px] tabular text-ink-900"
      >
        {formatEuro(value, { whole: true })}
        <Badge>berekend</Badge>
      </div>
    </FieldShell>
  );

  const bvCard = (def: AssetTypeDef, row: AssetRow, count: number) => {
    const extended = isExtended(row.metadata);
    const d = deriveBv(row.metadata);
    const derived: Record<string, number | null> = { eigen_vermogen: d.equity, resultaat_na_belasting: d.resultAfterTax };
    const name = typeof row.metadata.bv_naam === "string" && row.metadata.bv_naam ? row.metadata.bv_naam : def.label;
    const viaHolding = row.metadata.gehouden_door === "holding";
    const equity = d.equity ?? (typeof row.metadata.eigen_vermogen === "number" ? row.metadata.eigen_vermogen : null);
    const pct = typeof row.metadata.aandelen_percentage === "number" ? row.metadata.aandelen_percentage : null;
    return (
      <Card key={row.id}>
        <CardHeader
          title={name}
          description={viaHolding ? "Werkmaatschappij, gehouden via een holding" : "Box 2: aanmerkelijk belang"}
          action={
            count > 1 ? (
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-ink-500 hover:bg-danger-50 hover:text-danger-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Verwijderen
              </button>
            ) : null
          }
        />
        <div className="space-y-5 p-4 sm:p-5">
          {config.sections.partner ? <div className="max-w-xs">{ownerSelect(row, true)}</div> : null}
          {config.sections.balans || config.sections.resultaat ? (
            <label className="flex items-start gap-2.5 text-sm text-ink-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-gold-500"
                checked={extended}
                onChange={(e) => patchAsset(row.id, { meta: ["uitgebreid", e.target.checked ? "ja" : null] })}
              />
              <span>
                <span className="font-medium text-ink-900">Volledige balans en resultatenrekening invullen</span>
                <span className="block text-xs text-ink-500">
                  Eigen vermogen en resultaat na vennootschapsbelasting worden dan berekend.
                </span>
              </span>
            </label>
          ) : null}
          {bvSections.map((section) => {
            const fields = def.metadataFields.filter((f) => f.section === section.key && (!f.extended || extended));
            if (fields.length === 0) return null;
            return (
              <div key={section.key} className="space-y-3">
                <h4 className="text-sm font-semibold text-ink-800">{section.label}</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((f) => {
                    const value = extended ? derived[f.key] : null;
                    return value !== null && value !== undefined ? derivedField(row, f, value) : metaField(row, f);
                  })}
                </div>
                {section.key === "resultaat" && extended && d.vpb !== null && d.profitBeforeTax !== null ? (
                  <p className="text-xs text-ink-500 tabular">
                    Winst vóór belasting {formatEuro(d.profitBeforeTax, { whole: true })} · vennootschapsbelasting{" "}
                    {formatEuro(d.vpb, { whole: true })} (indicatief, na verliesverrekening)
                  </p>
                ) : null}
              </div>
            );
          })}
          {equity !== null && pct !== null && config.sections.balans && !viaHolding ? (
            <p className="border-l-2 border-gold-500 bg-ink-50 px-3 py-2 text-sm text-ink-700">
              Indicatieve waarde aandelen: <span className="font-semibold tabular">{formatEuro((equity * pct) / 100)}</span>
            </p>
          ) : null}
        </div>
      </Card>
    );
  };

  const bvSections = SECTIONS.filter((x) => x.side === "zakelijk" && x.key !== "eenmanszaak" && config.sections[x.key]);

  const soleTraderCard = () => {
    const def = getAssetType("eenmanszaak")!;
    const rows = assets.filter((a) => a.type === def.type);
    return (
      <Card>
        <CardHeader
          title="Eenmanszaak / IB-ondernemer"
          description="Winst uit onderneming valt in box 1 van de ondernemer, na zelfstandigenaftrek en MKB-winstvrijstelling."
        />
        <div className="space-y-4 p-4 sm:p-5">
          {assetBlock(def, "eenmanszaak")}
          {rows.map((row) => {
            const winst = typeof row.metadata.winst === "number" ? row.metadata.winst : null;
            if (winst === null) return null;
            const taxable = taxableBusinessProfit(winst, {
              hoursCriterion: row.metadata.urencriterium !== "nee",
              starter: row.metadata.starter === "ja",
              yearIndex: 0,
            });
            return (
              <p key={row.id} className="border-l-2 border-gold-500 bg-ink-50 px-3 py-2 text-sm text-ink-700">
                {typeof row.metadata.naam === "string" && row.metadata.naam ? `${row.metadata.naam}: ` : ""}belastbare winst na
                ondernemersaftrek en MKB-winstvrijstelling{" "}
                <span className="font-semibold tabular">{formatEuro(taxable, { whole: true })}</span> per jaar (indicatief).
              </p>
            );
          })}
        </div>
      </Card>
    );
  };

  const bvList = () => {
    if (bvSections.length === 0) return null;
    const def = getAssetType("bv_aandelen")!;
    const rows = assets.filter((a) => a.type === def.type);
    if (rows.length === 0) return <Card className="p-5">{assetBlock(def, bvSections[0].key)}</Card>;
    return (
      <>
        {rows.map((row) => bvCard(def, row, rows.length))}
        <Button variant="secondary" size="sm" onClick={() => void addRow(def.type)} disabled={adding === def.type}>
          <Plus className="h-4 w-4" /> BV toevoegen
        </Button>
      </>
    );
  };

  const intro: Record<PrivePart | "zakelijk", string> = {
    gezin: "Wie horen bij het huishouden? Dit bepaalt met wie het plan rekent.",
    woning: "De eigen woning en de hypotheek, zoals in box 1 van de IB-aangifte.",
    inkomen: "Alle inkomsten per jaar: loon, pensioen, lijfrente en overige inkomsten. Samen vormen ze de kasstroom.",
    uitgaven: "Wat het huishouden per jaar uitgeeft, en hoe dat verandert na het pensioen.",
    vermogen: "Spaargeld, beleggingen, ander vastgoed en schulden in box 3.",
    zakelijk: "Controleer de zakelijke gegevens (opgebouwd zoals de jaarrekening) en vul aan wat ontbreekt.",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">{intro[part]}</p>
        <SaveIndicator status={status} />
      </div>

      <Summary missing={missing} docCount={docCount} />

      {part === "gezin" ? (
        <>
          <Card>
            <CardHeader title="Cliënt" description="Nodig voor de projectie" />
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">{fieldsOf("gezin").map(inputField)}</div>
          </Card>
          <Card>
            <CardHeader title="Huishouden" />
            <div className="space-y-5 p-4 sm:p-5">
              {yesNo(
                "Partner meenemen in het plan?",
                "Nee: het plan rekent alleen met de cliënt, ook als er wel een partner is.",
                config.sections.partner,
                (v) => toggleSections({ partner: v }),
                "keuze-partner",
              )}
              {yesNo(
                "Zijn er kinderen?",
                "Met kinderen kun je schenkingen plannen en de gevolgen zien.",
                config.sections.kinderen,
                (v) => toggleSections({ kinderen: v }),
                "keuze-kinderen",
              )}
            </div>
          </Card>
          {config.sections.partner ? <PartnerCard inputs={inputs} missingIds={missingIds} onChange={saveInputs} /> : null}
          {config.sections.kinderen ? (
            <ChildrenCard inputs={inputs} missingIds={missingIds} referenceYear={new Date().getFullYear()} onChange={saveInputs} />
          ) : null}
        </>
      ) : null}

      {part === "woning" ? (
        <>
          <Card className="p-4 sm:p-5">
            {yesNo(
              "Is er een eigen woning?",
              "Een koopwoning waarin het huishouden zelf woont (box 1).",
              config.sections.eigen_woning,
              (v) => toggleSections({ eigen_woning: v }),
              "keuze-woning",
            )}
          </Card>
          {config.sections.eigen_woning
            ? priveCard("Eigen woning & hypotheek", "WOZ-waarde, hypotheekdelen en renteaftrek", { section: "eigen_woning", types: typesOf("woning") })
            : null}
        </>
      ) : null}

      {part === "inkomen" ? (
        <>
          {config.sections.inkomen
            ? priveCard("Inkomen uit werk", "Bruto per jaar, zoals op de jaaropgaaf of in box 1 van de aangifte.", {
                section: "inkomen",
                fields: fieldsOf("inkomen", "inkomen"),
              })
            : null}
          {config.sections.pensioen
            ? priveCard("Pensioen & lijfrente", "Pensioen van de werkgever vanaf de pensioendatum; AOW rekent Plannr zelf.", {
                section: "pensioen",
                fields: fieldsOf("inkomen", "pensioen"),
                types: typesOf("inkomen"),
              })
            : null}
          {config.sections.partner ? (
            <PartnerCard
              part="inkomen"
              inputs={inputs}
              missingIds={missingIds}
              onChange={saveInputs}
              extra={(key) =>
                key === "bruto_inkomen" ? (
                  <SalaryHelper
                    idPrefix="partner"
                    onApply={(v) =>
                      saveInputs({
                        ...inputs,
                        partner: { ...inputs.partner, bruto_inkomen: v },
                        fromDocument: inputs.fromDocument.filter((k) => k !== "partner.bruto_inkomen"),
                      })
                    }
                  />
                ) : null
              }
            />
          ) : null}
          {config.sections.inkomen || config.sections.pensioen ? (
            <CashItemsCard config={config} inputs={inputs} missingIds={missingIds} onChange={saveInputs} />
          ) : null}
        </>
      ) : null}

      {part === "uitgaven" ? (
        <>
          <ExpensesCard
            inputs={inputs}
            missing={missingIds.has("input.jaarlijkse_uitgaven")}
            fromDocument={inputs.fromDocument.includes("jaarlijkse_uitgaven")}
            onChange={saveInputs}
          />
          <AssumptionsCard inputs={inputs} firmReturns={firmReturns} onChange={saveInputs} show="pattern" />
        </>
      ) : null}

      {part === "vermogen" ? (
        <>
          {config.sections.box3
            ? priveCard("Vermogen box 3", "Spaargeld, beleggingen, overig onroerend goed en schulden", { section: "box3", types: typesOf("vermogen") })
            : null}
          <AssumptionsCard inputs={inputs} firmReturns={firmReturns} onChange={saveInputs} show="returns" />
        </>
      ) : null}

      {part === "zakelijk" ? (
        <>
          <Card>
            <CardHeader title="Welke onderdelen?" description="Kies wat er voor dit bedrijf in het plan komt." />
            <div className="grid gap-x-6 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
              {SECTIONS.filter((x) => x.side === "zakelijk").map((x) => (
                <label key={x.key} className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-ink-50">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                    checked={config.sections[x.key]}
                    disabled={toggling}
                    onChange={(e) => toggleSections({ [x.key]: e.target.checked })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink-900">{x.label}</span>
                    <span className="block text-xs text-ink-500">{x.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </Card>
          {bvList()}
          {config.sections.eenmanszaak ? soleTraderCard() : null}
        </>
      ) : null}
    </div>
  );
}

function Summary({ missing, docCount }: { missing: { id: string; label: string }[]; docCount: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div
        className={cn(
          "rounded-xl border px-4 py-3",
          missing.length > 0 ? "border-warn-600/30 bg-warn-50" : "border-ok-600/20 bg-ok-50",
        )}
      >
        <div className={cn("flex items-center gap-2 font-medium", missing.length > 0 ? "text-warn-600" : "text-ok-600")}>
          {missing.length > 0 ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {missing.length > 0
            ? `${missing.length} verplicht${missing.length === 1 ? " veld ontbreekt" : "e velden ontbreken"}`
            : "Alle verplichte velden zijn ingevuld"}
        </div>
        {missing.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {missing.slice(0, 8).map((m) => (
              <li key={m.id}>
                <a href={`#veld-${domId(m.id)}`} className="text-warn-600 underline decoration-warn-600/40 hover:decoration-warn-600">
                  {m.label}
                </a>
              </li>
            ))}
            {missing.length > 8 ? <li className="text-warn-600">en {missing.length - 8} meer</li> : null}
          </ul>
        ) : null}
      </div>
      <div className="rounded-xl border border-doc-600/20 bg-doc-50 px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-doc-600">
          <FileText className="h-4 w-4" />
          {docCount > 0 ? `${docCount} ${docCount === 1 ? "waarde" : "waarden"} uit document` : "Geen waarden uit documenten"}
        </div>
        <p className="mt-1 text-sm text-doc-600/80">
          {docCount > 0
            ? "Gemarkeerd met “uit document”. Controleer ze; na wijzigen verdwijnt de markering."
            : "Upload stukken bij Documenten om velden vooraf in te vullen."}
        </p>
      </div>
    </div>
  );
}
