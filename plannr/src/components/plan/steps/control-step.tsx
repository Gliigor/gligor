"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { AlertTriangle, Check, FileText, Plus, Trash2 } from "@/components/ui/icons";
import { addAsset, deleteAsset, updateAsset, updatePriveInputs } from "@/lib/actions/plan";
import {
  ASSET_TYPES,
  PRIVE_INPUT_FIELDS,
  SECTIONS,
  type AssetTypeDef,
  type FieldDef,
  type SectionKey,
  type Side,
} from "@/lib/plan/definitions";
import { findMissingFields, isFieldVisible } from "@/lib/plan/status";
import type { AssetRow, PlanConfig, PlanInputs } from "@/lib/plan/types";
import { formatEuro } from "@/lib/format";
import { FieldInput, FieldShell, NumberInput } from "../fields";
import { SaveIndicator, useAutosave } from "../use-autosave";

const domId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "-");

export function ControlStep({
  side,
  planId,
  config,
  initialInputs,
  initialAssets,
}: {
  side: Side;
  planId: string;
  config: PlanConfig;
  initialInputs: PlanInputs;
  initialAssets: AssetRow[];
}) {
  const [inputs, setInputs] = useState(initialInputs);
  const [assets, setAssets] = useState(initialAssets);
  const [adding, setAdding] = useState<string | null>(null);
  const { status, schedule } = useAutosave();

  const missing = useMemo(
    () => findMissingFields(config, inputs, assets).filter((m) => m.side === side),
    [config, inputs, assets, side],
  );
  const missingIds = useMemo(() => new Set(missing.map((m) => m.id)), [missing]);

  const sideAssets = assets.filter((a) => a.side === side);
  const docCount =
    (side === "prive" ? inputs.fromDocument.length : 0) +
    sideAssets.reduce((n, a) => n + (a.metadata._fromDocument?.length ?? 0), 0);

  // --- mutations ---------------------------------------------------------------
  function setInput(key: string, value: number | string | null) {
    const next: PlanInputs = {
      prive: { ...inputs.prive, [key]: value },
      fromDocument: inputs.fromDocument.filter((k) => k !== key),
    };
    setInputs(next);
    schedule("inputs", () => updatePriveInputs(planId, next.prive, next.fromDocument));
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
  const sections = SECTIONS.filter((s) => s.side === side && config.sections[s.key]);

  if (sections.length === 0 && side === "zakelijk") {
    return (
      <Card className="p-6 text-center text-sm text-ink-600">
        Er zijn geen zakelijke onderdelen aangevinkt in stap 1 (Configuratie). Deze stap is daarom niet van toepassing.
      </Card>
    );
  }

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
        value={row.metadata[field.key] ?? null}
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
              {def.metadataFields.filter((f) => f.section === section && isFieldVisible(f, config)).map((f) => metaField(row, f))}
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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-600">
          {side === "prive"
            ? "Controleer de privégegevens (opgebouwd zoals de IB-aangifte) en vul aan wat ontbreekt."
            : "Controleer de zakelijke gegevens (opgebouwd zoals de jaarrekening) en vul aan wat ontbreekt."}
        </p>
        <SaveIndicator status={status} />
      </div>

      <Summary missing={missing} docCount={docCount} />

      {side === "prive" ? (
        <Card>
          <CardHeader title="Algemeen" description="Nodig voor de projectie" />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            {PRIVE_INPUT_FIELDS.filter((f) => f.section === "algemeen").map(inputField)}
          </div>
        </Card>
      ) : null}

      {side === "prive"
        ? sections.map((section) => {
            const fields = PRIVE_INPUT_FIELDS.filter((f) => f.section === section.key);
            const types = ASSET_TYPES.filter((t) => t.side === "prive" && t.sections[0] === section.key);
            return (
              <Card key={section.key}>
                <CardHeader title={section.label} description={section.description} />
                <div className="space-y-5 p-4 sm:p-5">
                  {fields.length > 0 ? <div className="grid gap-4 sm:grid-cols-2">{fields.map(inputField)}</div> : null}
                  {types.map((t) => assetBlock(t, section.key))}
                </div>
              </Card>
            );
          })
        : ASSET_TYPES.filter((t) => t.side === "zakelijk").map((def) => {
            const rows = assets.filter((a) => a.type === def.type);
            if (rows.length === 0) {
              return (
                <Card key={def.type} className="p-5">
                  {assetBlock(def, sections[0].key)}
                </Card>
              );
            }
            return rows.map((row) => (
              <Card key={row.id}>
                <CardHeader
                  title={typeof row.metadata.bv_naam === "string" && row.metadata.bv_naam ? row.metadata.bv_naam : def.label}
                  description="Box 2 — aanmerkelijk belang"
                />
                <div className="space-y-5 p-4 sm:p-5">
                  {sections.map((section) => {
                    const fields = def.metadataFields.filter((f) => f.section === section.key);
                    if (fields.length === 0) return null;
                    return (
                      <div key={section.key} className="space-y-3">
                        <h4 className="text-sm font-semibold text-ink-800">{section.label}</h4>
                        <div className="grid gap-4 sm:grid-cols-2">{fields.map((f) => metaField(row, f))}</div>
                      </div>
                    );
                  })}
                  {typeof row.metadata.eigen_vermogen === "number" &&
                  typeof row.metadata.aandelen_percentage === "number" &&
                  config.sections.balans ? (
                    <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">
                      Indicatieve waarde aandelen:{" "}
                      <span className="font-semibold tabular">
                        {formatEuro((row.metadata.eigen_vermogen * row.metadata.aandelen_percentage) / 100)}
                      </span>
                    </p>
                  ) : null}
                </div>
              </Card>
            ));
          })}
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
            : "Upload stukken in stap 2 om velden vooraf in te vullen."}
        </p>
      </div>
    </div>
  );
}
