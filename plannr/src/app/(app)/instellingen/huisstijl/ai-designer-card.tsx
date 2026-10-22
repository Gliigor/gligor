"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormError, Label } from "@/components/ui/form";
import { Check, Loader2, Sparkles } from "@/components/ui/icons";
import { designHouseStyleAction } from "@/lib/actions/settings";
import { MAX_WISH_LENGTH, type ReportDesign } from "@/lib/house-style/designs";
import { LayoutThumbnail } from "./layout-thumbnail";

export function designPreviewUrl(d: Omit<ReportDesign, "name" | "rationale">): string {
  const q = new URLSearchParams({
    primary: d.primaryColor.slice(1),
    secondary: d.secondaryColor.slice(1),
    accent: d.accentColor.slice(1),
    heading: d.fontHeading,
    body: d.fontBody,
    cover: d.blocks.cover,
    opener: d.blocks.opener,
    panel: d.blocks.panel,
  });
  return `/api/huisstijl/voorbeeld?${q.toString()}`;
}

export function AiDesignerCard({
  aiAvailable,
  attemptsLeft: initialAttempts,
  firmName,
  logoUrl,
  onApply,
}: {
  aiAvailable: boolean;
  attemptsLeft: number | null;
  firmName: string;
  logoUrl: string | null;
  onApply: (design: ReportDesign) => Promise<boolean>;
}) {
  const [wish, setWish] = useState("");
  const [designs, setDesigns] = useState<ReportDesign[] | null>(null);
  const [method, setMethod] = useState<"ai" | "voorbeeld" | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(initialAttempts);
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [applying, setApplying] = useState<string | null>(null);
  const noAttempts = aiAvailable && attemptsLeft !== null && attemptsLeft <= 0;

  function design() {
    setError(null);
    setChosen(null);
    start(async () => {
      const res = await designHouseStyleAction(wish);
      if (typeof res.attemptsLeft === "number") setAttemptsLeft(res.attemptsLeft);
      if (!res.ok || !res.designs) return setError(res.error ?? "Er ging iets mis.");
      setDesigns(res.designs);
      setMethod(res.method ?? null);
    });
  }

  async function apply(d: ReportDesign) {
    setApplying(d.name);
    try {
      if (await onApply(d)) setChosen(d.name);
    } finally {
      setApplying(null);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Ontwerp met AI"
        description="Beschrijf wat je wilt; je krijgt drie ontwerpen om uit te kiezen. Alleen het uiterlijk verandert: tekst, cijfers en grafieken blijven precies hetzelfde."
      />
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <Label htmlFor="ontwerp-wens">Jouw wens (optioneel)</Label>
          <textarea
            id="ontwerp-wens"
            value={wish}
            maxLength={MAX_WISH_LENGTH}
            onChange={(e) => setWish(e.target.value)}
            rows={3}
            placeholder="Bijvoorbeeld: rustig en chic, veel wit, goud als accent, past bij ons logo."
            className="w-full rounded-sm border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-ink-500">
            De AI gebruikt je logo, je website en deze wens. Er gaan geen cliëntgegevens naar de AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={design} disabled={busy || noAttempts}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Ontwerpen maken…" : "Maak 3 ontwerpen"}
          </Button>
          <span className="text-sm text-ink-500">
            {aiAvailable
              ? attemptsLeft === null
                ? null
                : noAttempts
                  ? "Je pogingen zijn op. Neem contact op met Plannr voor extra pogingen."
                  : `Nog ${attemptsLeft} ${attemptsLeft === 1 ? "poging" : "pogingen"}. Een poging telt alleen als het lukt.`
              : "De AI-ontwerper staat nog uit; je krijgt drie voorbeeldontwerpen op basis van je huidige kleuren."}
          </span>
        </div>
        <FormError message={error} />

        {designs ? (
          <div className="space-y-3">
            {method === "voorbeeld" ? (
              <p className="border-l-2 border-warn-600 bg-warn-50 px-3 py-2 text-sm text-ink-700">
                Voorbeeldontwerpen: gemaakt zonder AI, uit je huidige kleuren. Er is geen poging gebruikt.
              </p>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-3">
              {designs.map((d) => (
                <div key={d.name} className="overflow-hidden rounded-xl border-2 border-ink-200 bg-white">
                  <LayoutThumbnail blocks={d.blocks} style={d} firmName={firmName} logoUrl={logoUrl} />
                  <div className="space-y-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{d.name}</span>
                      <a
                        href={designPreviewUrl(d)}
                        target="_blank"
                        rel="noopener"
                        className="text-xs font-semibold text-ink-900 underline decoration-gold-500 underline-offset-4 hover:decoration-2"
                      >
                        Volledig bekijken (PDF)
                      </a>
                    </div>
                    <p className="text-sm text-ink-500">{d.rationale}</p>
                    <div className="flex items-center gap-1.5" aria-label="Kleuren">
                      {[d.primaryColor, d.secondaryColor, d.accentColor].map((c) => (
                        <span key={c} className="h-4 w-4 rounded-full ring-1 ring-ink-200" style={{ background: c }} title={c} />
                      ))}
                      <span className="ml-1 truncate text-xs text-ink-500">
                        {d.fontHeading} · {d.fontBody}
                      </span>
                    </div>
                    <Button
                      variant={chosen === d.name ? "primary" : "secondary"}
                      size="sm"
                      className="w-full"
                      disabled={applying !== null}
                      onClick={() => void apply(d)}
                    >
                      {applying === d.name ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : chosen === d.name ? (
                        <>
                          <Check className="h-4 w-4" /> Gekozen en opgeslagen
                        </>
                      ) : (
                        "Kies dit ontwerp"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
