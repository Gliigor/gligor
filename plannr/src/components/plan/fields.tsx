"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/components/ui/cn";
import { inputClass } from "@/components/ui/form";
import { FileText } from "@/components/ui/icons";
import type { FieldDef } from "@/lib/plan/definitions";
import { parseDutchNumber } from "@/lib/format";

const nl = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 });
const nlYear = new Intl.NumberFormat("nl-NL", { useGrouping: false, maximumFractionDigits: 0 });

export function FieldShell({
  id,
  label,
  help,
  missing,
  fromDocument,
  children,
}: {
  id: string;
  label: string;
  help?: string;
  missing?: boolean;
  fromDocument?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div id={`veld-${id}`} className="scroll-mt-28">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {fromDocument ? (
          <Badge tone="doc" title="Deze waarde is uit een geüpload document gehaald. Controleer hem.">
            <FileText className="h-3 w-3" /> uit document
          </Badge>
        ) : null}
        {missing ? <Badge tone="warn">Ontbreekt</Badge> : null}
      </div>
      {children}
      {help ? <p className="mt-1 text-xs text-ink-500">{help}</p> : null}
    </div>
  );
}

function fieldBorder(missing?: boolean, fromDocument?: boolean) {
  if (missing) return "border-warn-600 bg-warn-50 focus:border-warn-600 focus:ring-warn-100";
  if (fromDocument) return "border-doc-600/40 bg-doc-50/60";
  return "";
}

/** Text input for money / percent / integer values with Dutch formatting. */
export function NumberInput({
  id,
  kind,
  value,
  onChange,
  missing,
  fromDocument,
}: {
  id: string;
  kind: "money" | "percent" | "integer";
  value: number | null;
  onChange: (value: number | null) => void;
  missing?: boolean;
  fromDocument?: boolean;
}) {
  const format = (v: number | null) => (v === null ? "" : kind === "integer" ? nlYear.format(v) : nl.format(v));
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(format(value));
  const [invalid, setInvalid] = useState(false);

  return (
    <div className="relative">
      {kind === "money" ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">€</span>
      ) : null}
      <input
        id={id}
        inputMode={kind === "integer" ? "numeric" : "decimal"}
        autoComplete="off"
        className={cn(
          inputClass,
          "tabular",
          kind === "money" && "pl-7",
          kind === "percent" && "pr-8",
          fieldBorder(missing, fromDocument),
          invalid && "border-danger-600",
        )}
        value={focused ? text : format(value)}
        onFocus={() => {
          setFocused(true);
          setText(format(value));
        }}
        onBlur={() => {
          setFocused(false);
          setInvalid(false);
        }}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseDutchNumber(e.target.value);
          if (n === null) {
            setInvalid(false);
            onChange(null);
          } else if (Number.isNaN(n)) {
            setInvalid(true);
          } else {
            setInvalid(false);
            onChange(kind === "integer" ? Math.round(n) : n);
          }
        }}
        aria-invalid={invalid || undefined}
      />
      {kind === "percent" ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">%</span>
      ) : null}
      {invalid ? <p className="mt-1 text-xs text-danger-600">Vul een geldig getal in, bijvoorbeeld 1.250.000 of 3,5.</p> : null}
    </div>
  );
}

/** Renders the right control for a FieldDef. */
export function FieldInput({
  id,
  field,
  value,
  onChange,
  missing,
  fromDocument,
}: {
  id: string;
  field: FieldDef;
  value: unknown;
  onChange: (value: number | string | null) => void;
  missing?: boolean;
  fromDocument?: boolean;
}) {
  let control: React.ReactNode;
  if (field.kind === "select") {
    control = (
      <select
        id={id}
        className={cn(inputClass, fieldBorder(missing, fromDocument))}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Maak een keuze</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === "text") {
    control = (
      <input
        id={id}
        className={cn(inputClass, fieldBorder(missing, fromDocument))}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  } else {
    control = (
      <NumberInput
        id={id}
        kind={field.kind}
        value={typeof value === "number" ? value : null}
        onChange={onChange}
        missing={missing}
        fromDocument={fromDocument}
      />
    );
  }
  return (
    <FieldShell id={id} label={field.label} help={field.help} missing={missing} fromDocument={fromDocument}>
      {control}
    </FieldShell>
  );
}
