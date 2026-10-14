"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/lato/400.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/roboto/400.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/700.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/700.css";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/700.css";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { FormError, FormSuccess, Hint, Input, Label, Select } from "@/components/ui/form";
import { Check, Loader2, Sparkles, Trash2, Upload } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/client";
import { FONT_OPTIONS } from "@/lib/house-style/fonts";
import { LAYOUT_VARIANTS, type HouseStyle } from "@/lib/house-style/types";
import type { LayoutVariant } from "@/lib/plan/types";
import { LayoutThumbnail } from "./layout-thumbnail";
import { saveHouseStyleAction, setLogoAction, suggestFromWebsiteAction } from "@/lib/actions/settings";

type ColorKey = "primaryColor" | "secondaryColor" | "accentColor";
const COLOR_FIELDS: { key: ColorKey; label: string; hint: string }[] = [
  { key: "primaryColor", label: "Hoofdkleur", hint: "Koppen en belangrijkste grafieklijnen" },
  { key: "secondaryColor", label: "Secundaire kleur", hint: "Tweede grafiekkleur" },
  { key: "accentColor", label: "Accentkleur", hint: "Lijnen en details" },
];

export function HouseStyleEditor({
  firmId,
  firmName,
  initial,
  logoUrl,
  website: initialWebsite,
}: {
  firmId: string;
  firmName: string;
  initial: HouseStyle;
  logoUrl: string | null;
  website: string;
}) {
  const [style, setStyle] = useState(initial);
  const [website, setWebsite] = useState(initialWebsite);
  const [notes, setNotes] = useState<string[]>([]);
  const [logo, setLogo] = useState(logoUrl);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty = JSON.stringify({ ...style, logoPath: null }) !== JSON.stringify({ ...initial, logoPath: null });

  // Debounced preview parameters so dragging a color picker doesn't render dozens of PDFs.
  const [previewStyle, setPreviewStyle] = useState(style);
  useEffect(() => {
    const t = setTimeout(() => setPreviewStyle(style), 900);
    return () => clearTimeout(t);
  }, [style]);
  const previewQuery = useMemo(() => {
    const q = new URLSearchParams({
      primary: previewStyle.primaryColor.slice(1),
      secondary: previewStyle.secondaryColor.slice(1),
      accent: previewStyle.accentColor.slice(1),
      heading: previewStyle.fontHeading,
      body: previewStyle.fontBody,
      n: String(previewNonce),
    });
    return q.toString();
  }, [previewStyle, previewNonce]);

  function suggest() {
    setError(null);
    setMessage(null);
    startSuggest(async () => {
      const res = await suggestFromWebsiteAction(website);
      if (!res.ok || !res.suggestion) return setError(res.error ?? "Er ging iets mis.");
      const s = res.suggestion;
      setStyle((cur) => ({
        ...cur,
        primaryColor: s.primaryColor,
        secondaryColor: s.secondaryColor,
        accentColor: s.accentColor,
        fontHeading: s.fontHeading,
        fontBody: s.fontBody,
      }));
      setNotes([...s.notes, "Voorstel ingevuld — pas aan waar nodig en klik op Opslaan."]);
    });
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) return setError("Upload het logo als PNG of JPG.");
    if (file.size > 2 * 1024 * 1024) return setError("Het logo mag maximaal 2 MB zijn.");
    setUploading(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `${firmId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await createClient().storage.from("logos").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const res = await setLogoAction(path);
      if (!res.ok) throw new Error(res.error);
      setLogo(URL.createObjectURL(file));
      setPreviewNonce((n) => n + 1);
    } catch {
      setError("Het logo kon niet worden geüpload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeLogo() {
    startSave(async () => {
      const res = await setLogoAction(null);
      if (res.ok) {
        setLogo(null);
        setPreviewNonce((n) => n + 1);
      }
    });
  }

  function save() {
    setError(null);
    setMessage(null);
    startSave(async () => {
      const res = await saveHouseStyleAction(style);
      if (!res.ok) setError(res.error ?? "Opslaan is niet gelukt.");
      else setMessage(res.message ?? "Opgeslagen.");
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="1. Website" description="We stellen kleuren en het best passende lettertype voor op basis van je website." />
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="website">Website-adres</Label>
              <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.jouwkantoor.nl" inputMode="url" />
            </div>
            <Button variant="secondary" onClick={suggest} disabled={suggesting || !website.trim()}>
              {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Stijl voorstellen
            </Button>
          </div>
          {notes.length > 0 ? (
            <ul className="space-y-0.5 text-sm text-ink-600">
              {notes.map((n) => (
                <li key={n}>• {n}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="2. Logo" description="PNG of JPG, maximaal 2 MB. Bij voorkeur op transparante of witte achtergrond." />
          <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
            <div className="flex h-20 w-40 items-center justify-center rounded-lg border border-ink-200 bg-white p-2">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo van het kantoor" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-ink-400">Geen logo</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logo ? "Vervangen" : "Logo uploaden"}
              </Button>
              {logo ? (
                <Button variant="ghost" size="sm" onClick={removeLogo} disabled={saving}>
                  <Trash2 className="h-4 w-4" /> Verwijderen
                </Button>
              ) : null}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(e) => void uploadLogo(e.target.files?.[0])} aria-label="Logo uploaden" />
          </div>
        </Card>

        <Card>
          <CardHeader title="3. Kleuren" description="Voorgesteld op basis van je website, altijd aan te passen." />
          <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
            {COLOR_FIELDS.map((c) => (
              <div key={c.key}>
                <Label htmlFor={c.key}>{c.label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label={`${c.label} kiezen`}
                    value={style[c.key]}
                    onChange={(e) => setStyle({ ...style, [c.key]: e.target.value.toUpperCase() })}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-ink-200 bg-white p-1"
                  />
                  <Input
                    id={c.key}
                    value={style[c.key]}
                    maxLength={7}
                    onChange={(e) => {
                      const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setStyle({ ...style, [c.key]: v.length === 7 ? v.toUpperCase() : v });
                    }}
                    className="font-mono text-sm"
                  />
                </div>
                <Hint>{c.hint}</Hint>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="4. Lettertypen" description="Een vaste selectie die goed werkt in PDF's." />
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
          {(["fontHeading", "fontBody"] as const).map((key) => (
            <div key={key}>
              <Label htmlFor={key}>{key === "fontHeading" ? "Koppen" : "Lopende tekst"}</Label>
              <Select id={key} value={style[key]} onChange={(e) => setStyle({ ...style, [key]: e.target.value })}>
                <optgroup label="Schreefloos">
                  {FONT_OPTIONS.filter((f) => f.category === "sans").map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Schreef">
                  {FONT_OPTIONS.filter((f) => f.category === "serif").map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
              <p
                className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-ink-800"
                style={{ fontFamily: `"${style[key]}"`, fontSize: key === "fontHeading" ? 22 : 15, fontWeight: key === "fontHeading" ? 700 : 400, color: key === "fontHeading" ? style.primaryColor : undefined }}
              >
                {key === "fontHeading" ? "Vermogensoverzicht 2026" : "Het totale netto vermogen bedraagt € 2.220.000."}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="5. Lay-out"
          description="Drie complete voorbeeldrapporten met jouw instellingen en voorbeelddata. Bekijk de volledige PDF en kies de lay-out die het beste past."
        />
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-3">
          {LAYOUT_VARIANTS.map((v) => {
            const selected = style.layoutVariant === v.key;
            const src = `/api/huisstijl/voorbeeld?variant=${v.key}&${previewQuery}`;
            return (
              <div
                key={v.key}
                className={cn(
                  "overflow-hidden rounded-xl border-2 bg-white transition-colors",
                  selected ? "border-brand-600" : "border-ink-200",
                )}
              >
                <LayoutThumbnail variant={v.key} style={style} firmName={firmName} logoUrl={logo} />
                <div className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{v.label}</span>
                    <a href={src} target="_blank" rel="noopener" className="text-xs font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2">
                      Volledig bekijken (PDF)
                    </a>
                  </div>
                  <p className="text-sm text-ink-500">{v.description}</p>
                  <Button
                    variant={selected ? "primary" : "secondary"}
                    size="sm"
                    className="w-full"
                    onClick={() => setStyle({ ...style, layoutVariant: v.key as LayoutVariant })}
                  >
                    {selected ? (
                      <>
                        <Check className="h-4 w-4" /> Gekozen
                      </>
                    ) : (
                      "Kies deze lay-out"
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-ink-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <FormError message={error} />
            <FormSuccess message={message} />
            {!error && !message ? (
              <span className="text-sm text-ink-500">{dirty ? "Je hebt niet-opgeslagen wijzigingen." : "Alles is opgeslagen."}</span>
            ) : null}
          </div>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Opslaan
          </Button>
        </div>
      </div>
    </div>
  );
}
