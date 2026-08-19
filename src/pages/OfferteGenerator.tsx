import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ConstellationBackground from "@/components/ConstellationBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Save } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OfferteOnderdeel {
  id: string;
  naam: string;
  beschrijving: string;
}

interface OfferteGegevens {
  werknemerNaam: string;
  werknemersAdres: string;
  clientNaam: string;
  clientAdres: string;
  offerteDatum: string;
  valserij: string;
  werkwijzeOmschrijving: string;
  gekozenOnderdelen: Set<string>;
  acties: Record<string, string>;
  bijlageBestand: File | null;
  bijlageUrl: string;
}

// ─── Categorieën en onderdelen ─────────────────────────────────────────────
const onderdelen = [
  {
    id: "dak",
    naam: "Dak",
    onderdelen: [
      { id: "dakpannen", naam: "Dakpannen", beschrijving: "Daken, dakbedekking, pannen, schuttingen" },
      { id: "dakgoten", naam: "Dakgoten", beschrijving: "Waterafvoer via dakgoten en leidingen" },
      { id: "dakconstructie", naam: "Dakconstructie", beschrijving: "Dakvloer, stenope, houten dakconstructie" },
      { id: "dakisolatie", naam: "Dakisolatie", beschrijving: "Isolatie voor warmte- en geluidsisolatie" },
    ],
  },
  {
    id: "gevel",
    naam: "Gevel",
    onderdelen: [
      { id: "gevelwanden", naam: "Wanden", beschrijving: "Murale wanden en gevels" },
      { id: "gevelschoorsteen", naam: "Schoorsteen", beschrijving: "Gevelschoorsteen en leidingen" },
      { id: "gevelbevestiging", naam: "Bevestiging", beschrijving: "Bevestiging en steunpunten" },
    ],
  },
  {
    id: "interieur",
    naam: "Interieur",
    onderdelen: [
      { id: "interiwwanden", naam: "Wanden", beschrijving: "Binnenwanden en stenen wanden" },
      { id: "vloeren", naam: "Vloeren", beschrijving: "Vloerbedekking, parket, laminaat" },
      { id: "kozijnen", naam: "Kozijnen", beschrijving: "Deuren, ramen en venstelblokken" },
      { id: "trappen", naam: "Trappen", beschrijving: "Trappen, uitkeringen en banken" },
      { id: "kookgelegenheid", naam: "Kookgelegenheid", beschrijving: "Kookgelegenheid en keukenwand" },
      { id: "badkamer", naam: "Badkamer", beschrijving: "Badvoertuigen, toiletten, wastafels" },
      { id: "woonkamerwanden", naam: "Wanden woonkamer", beschrijving: "Wanden, decoratie en afwerkingen" },
    ],
  },
  {
    id: "tuin",
    naam: "Tuin",
    onderdelen: [
      { id: "tuinvoorbereiding", naam: "Tuinvoorbereiding", beschrijving: "Grounded, bodemverbetering" },
      { id: "tuininrichting", naam: "Tuininrichting", beschrijving: "Meubilair, felder, leuningen" },
      { id: "hedge", naam: "Hekken", beschrijving: "Hekken, poorten en uitgangsbegeleiding" },
    ],
  },
  {
    id: "installaties",
    naam: "Installaties",
    onderdelen: [
      { id: "verwarming", naam: "Verwarming", beschrijving: "Cv-ketel, radiators, warmtepomp" },
      { id: "infrastructuur", naam: "Infrastructuur", beschrijving: "Doorbereiding elektra, waterleidingen" },
      { id: "luchtdicht", naam: "Luchtdichtheidsinspectie", beschrijving: "Lucht- en vochtinspectie" },
    ],
  },
  {
    id: "onderhoud",
    naam: "Onderhoud",
    onderdelen: [
      { id: "schilderwerk", naam: "Schilderwerk", beschrijving: "Schilderen, lakken, houtonderhoud" },
      { id: "reparaties", naam: "Reparaties", beschrijving: "Diversen reparaties en hobbys" },
    ],
  },
];

// ─── Hoofdcomponent ────────────────────────────────────────────────────────
export default function OfferteGenerator() {
  const [stap, setStap] = useState<number>(1);
  const [gegevens, setGegevens] = useState<OfferteGegevens>({
    werknemerNaam: "",
    werknemersAdres: "",
    clientNaam: "",
    clientAdres: "",
    offerteDatum: new Date().toISOString().split("T")[0],
    valserij: "1",
    werkwijzeOmschrijving: "",
    gekozenOnderdelen: new Set(),
    acties: {},
    bijlageBestand: null,
    bijlageUrl: "",
  });

  // ── Alle onderdelen pluckeren ───────────────────────────────────────────
  const alleOnderdelen: OfferteOnderdeel[] = [];
  onderdelen.forEach((cat) => {
    cat.onderdelen.forEach((o) => alleOnderdelen.push(o));
  });

  // ── Stap 1: Werkwaarden en intake ─────────────────────────────────────
  const handleWerkwaardenChange = (key: keyof OfferteGegevens) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setGegevens({ ...gegevens, [key]: e.target.value });
  };

  // ── Stap 2: Categorie-tiles ────────────────────────────────────────────
  const toggleOnderdeel = (id: string) => {
    const nieuwSet = new Set(gegevens.gekozenOnderdelen);
    if (nieuwSet.has(id)) {
      nieuwSet.delete(id);
      const nieuweActies = { ...gegevens.acties };
      delete nieuweActies[id];
      setGegevens({ ...gegevens, gekozenOnderdelen: nieuwSet, acties: nieuweActies });
    } else {
      nieuwSet.add(id);
      setGegevens({ ...gegevens, gekozenOnderdelen: nieuwSet });
    }
  };

  // ── Actie invullen ───────────────────────────────────────────────────────
  const handleActieChange = (onderdeelId: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGegevens({
      ...gegevens,
      acties: { ...gegevens.acties, [onderdeelId]: e.target.value },
    });
  };

  // ── Bijlage uploaden ─────────────────────────────────────────────────────
  const handleBijlageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setGegevens({ ...gegevens, bijlageBestand: file, bijlageUrl: url });
    }
  };

  // ── Exporteren (HTML) ───────────────────────────────────────────────────
  const exporteerOfferte = () => {
    const html = genereerOfferteHtml(gegevens, alleOnderdelen);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `offerte-${gegevens.clientNaam.replace(/\s+/g, "-").toLowerCase() || "nieuw"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF via print ─────────────────────────────────────────────────────────
  const printPdf = () => {
    window.print();
  };

  // ── Navigatie stappen ───────────────────────────────────────────────────
  const nextStap = () => {
    if (stap < 3) setStap(stap + 1);
  };

  const vorigeStap = () => {
    if (stap > 1) setStap(stap - 1);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background relative">
      <ConstellationBackground />
      <Header />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600&family=Orbitron:wght@400;500;600;700;800&display=swap');

          .category-tile {
            background: linear-gradient(135deg, var(--tw-gradient-stops));
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            transition: all 0.2s ease;
            cursor: pointer;
          }
          .category-tile:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
          }
          .category-tile.active {
            box-shadow: 0 0 30px rgba(0,229,255,0.4);
            border-color: rgba(0,229,255,0.5);
          }
          .step-indicator {
            display: flex;
            gap: 8px;
            margin-bottom: 24px;
          }
          .step-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
          }
          .step-dot.active {
            background: #00e5ff;
            box-shadow: 0 0 15px #00e5ff;
          }
        `}</style>

        {/* Titel en step indicator */}
        <div className="text-center mb-12">
          <p className="text-xs tracking-[0.25em] text-primary/60 mb-3 uppercase">Bouwofferte Generator</p>
          <h1
            style={{
              fontFamily: "'Orbitron',sans-serif",
              fontSize: "clamp(24px,4vw,38px)",
              fontWeight: 800,
              color: "#e2e8f0",
              marginBottom: 12,
            }}
          >
            Offerte {stap}/3
          </h1>
          <div className="step-indicator justify-center">
            <div className={`step-dot ${stap >= 1 ? "active" : ""}`} />
            <div className={`step-dot ${stap >= 2 ? "active" : ""}`} />
            <div className={`step-dot ${stap >= 3 ? "active" : ""}`} />
          </div>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
            {stap === 1 && "Geef uw gegevens en omschrijf hoe u wilt werken en wat u wilt zien in de offerte"}
            {stap === 2 && "Selecteer de onderdelen die van toepassing zijn op uw project"}
            {stap === 3 && "Geef acties op voor elk gekozen onderdeel en bekijk uw offerte"}
          </p>
        </div>

        {/* ==================== STAP 1: Werkwaarden ==================== */}
        {stap === 1 && (
          <Card className="bg-card/50 border-border/30">
            <CardHeader>
              <CardTitle className="font-display text-xl">Werkwaarden & Intake</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="werknemerNaam">Uw naam (aannemer)</Label>
                  <Input
                    id="werknemerNaam"
                    value={gegevens.werknemerNaam}
                    onChange={handleWerkwaardenChange("werknemerNaam")}
                    placeholder="Bijv. Jan Bouwman"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="werkwoordenAdres">Adres (aannemer)</Label>
                  <Input
                    id="werkwoordenAdres"
                    value={gegevens.werkwoordenAdres}
                    onChange={handleWerkwaardenChange("werkwoordenAdres")}
                    placeholder="Bijv. Voorstraat 123, 1234 AB Amstelveen"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="clientNaam">Naam klant</Label>
                  <Input
                    id="clientNaam"
                    value={gegevens.clientNaam}
                    onChange={handleWerkwaardenChange("clientNaam")}
                    placeholder="Bijv. Jantje Jansen"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="clientAdres">Adres klant</Label>
                  <Input
                    id="clientAdres"
                    value={gegevens.clientAdres}
                    onChange={handleWerkwaardenChange("clientAdres")}
                    placeholder="Bijv. Klaasstraat 45, 5678 CD Utrecht"
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="offerteDatum">Offerte datum</Label>
                <Input
                  id="offerteDatum"
                  type="date"
                  value={gegevens.offerteDatum}
                  onChange={handleWerkwaardenChange("offerteDatum")}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="valserij">Valserij</Label>
                <Input
                  id="valserij"
                  value={gegevens.valserij}
                  onChange={handleWerkwaardenChange("valserij")}
                  placeholder="Bijv. 1.0, 1.5, 2.0"
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="werkwoordenOmschrijving">Hoe wilt u werken?</Label>
                <Textarea
                  id="werkwoordenOmschrijving"
                  value={gegevens.werkwijzeOmschrijving}
                  onChange={handleWerkwaardenChange("werkwijzeOmschrijving")}
                  placeholder="Beschrijf hier hoe u wilt werken, deadlines, keuzes, etc."
                  rows={4}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Geef hier uw werkwijze op: hoe moet er gewerkt worden? Welke keuzes moeten we maken?
                </p>
              </div>

              <div className="border-dashed border-2 border-border rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-2">Upload een voorbeeldofferte (optioneel)</p>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={handleBijlageSelect}
                  className="hidden"
                  id="bijlage-upload"
                />
                <label
                  htmlFor="bijlage-upload"
                  className="cursor-pointer inline-block px-4 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                >
                  Kies bestand
                </label>
                {gegevens.bijlageBestand && (
                  <p className="text-xs text-green-500 mt-2">✓ {gegevens.bijlageBestand.name}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ==================== STAP 2: Categorie-tiles ==================== */}
        {stap === 2 && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {onderdelen.map((cat) => (
                <div key={cat.id}>
                  <h3 className="text-xs text-muted-foreground mb-2 uppercase tracking-wider">{cat.naam}</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {cat.onderdelen.map((ond) => (
                      <div
                        key={ond.id}
                        onClick={() => toggleOnderdeel(ond.id)}
                        className={`category-tile p-3 ${gegevens.gekozenOnderdelen.has(ond.id) ? "active" : "opacity-60"}`}
                      >
                        <div className="font-medium text-sm">{ond.naam}</div>
                        <div className="text-xs text-muted-foreground/80 mt-1">{ond.beschrijving}</div>
                        {gegevens.gekozenOnderdelen.has(ond.id) && (
                          <div className="mt-2 text-xs text-primary">✓ Geselecteerd</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {gegevens.gekozenOnderdelen.size > 0 && (
              <div className="mt-6 p-4 bg-secondary/10 rounded-lg">
                <p className="text-sm">
                  <span className="font-medium">{gegevens.gekozenOnderdelen.size}</span> onderdeel
                  {gegevens.gekozenOnderdelen.size > 1 ? "en" : ""} geselecteerd
                </p>
              </div>
            )}
          </div>
        )}

        {/* ==================== STAP 3: Acties & Overzicht ==================== */}
        {stap === 3 && (
          <div>
            {gegevens.gekozenOnderdelen.size === 0 ? (
              <Card className="bg-card/50 border-border/30">
                <CardContent className="text-center py-12">
                  <p className="text-muted-foreground mb-4">U heeft nog geen onderdelen geselecteerd.</p>
                  <Button onClick={vorigeStap}>Terug naar selectie</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="bg-card/50 border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Acties Specificeren</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from(gegevens.gekozenOnderdelen).map((id) => {
                        const onderdeel = alleOnderdelen.find((o) => o.id === id);
                        return (
                          <div key={id}>
                            <Label htmlFor={`actie-${id}`} className="text-sm font-medium">
                              {onderdeel?.naam || id}
                            </Label>
                            <Textarea
                              id={`actie-${id}`}
                              value={gegevens.acties[id] || ""}
                              onChange={handleActieChange(id)}
                              placeholder="Bijv. Dakpannen verwijderen en vervangen door nieuwe keramische pannen..."
                              rows={2}
                              className="mt-2"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Eindoverzicht */}
                <Card className="bg-card/50 border-border/30">
                  <CardHeader>
                    <CardTitle className="font-display text-xl">Offerte Overzicht</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {gegevens.gekozenOnderdelen.size > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                            Gekozen Onderdelen
                          </h3>
                          <div className="grid gap-2">
                            {Array.from(gegevens.gekozenOnderdelen).map((id) => {
                              const onderdeel = alleOnderdelen.find((o) => o.id === id);
                              return (
                                <div key={id} className="p-3 bg-secondary/20 rounded-md">
                                  <div className="font-medium text-sm">{onderdeel?.naam || id}</div>
                                  {gegevens.acties[id] && (
                                    <div className="text-xs text-muted-foreground mt-1">{gegevens.acties[id]}</div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={vorigeStap}>
                    Terug
                  </Button>
                  <Button onClick={exporteerOfferte} className="gap-2">
                    <Save className="h-4 w-4" />
                    Exporteer
                  </Button>
                  <Button onClick={printPdf} className="gap-2">
                    PDF 📄
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// ── HTML generatie functie ─────────────────────────────────────────────────
const genereerOfferteHtml = (g: OfferteGegevens, onder: OfferteOnderdeel[]): string => `
  <!DOCTYPE html>
  <html lang="nl">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offerte ${g.clientNaam || "Nieuw"}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;500;600&family=Orbitron:wght@400;500;600;700;800&display=swap');
      * { box-sizing: border-box; }
      body {
        font-family: 'Exo 2', sans-serif;
        background: #0a0a12;
        color: #e2e8f0;
        margin: 0;
        padding: 40px;
      }
      .offerte-container {
        max-width: 800px;
        margin: 0 auto;
        background: rgba(255,255,255,0.02);
        border-radius: 16px;
        padding: 40px;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .header {
        text-align: center;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 24px;
        margin-bottom: 32px;
      }
      .logo {
        font-family: 'Orbitron', sans-serif;
        font-size: 28px;
        font-weight: 800;
        background: linear-gradient(135deg, #00e5ff, #60a5fa);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .section {
        margin-bottom: 32px;
      }
      .section-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.2em;
        color: #64748b;
        text-transform: uppercase;
        margin-bottom: 16px;
      }
      .field-row {
        display: flex;
        gap: 24px;
        margin-bottom: 12px;
      }
      .field-label {
        font-size: 12px;
        color: #475569;
        letter-spacing: 0.1em;
        min-width: 140px;
      }
      .field-value {
        font-size: 14px;
        color: #cbd5e1;
      }
      .onderdeel-row {
        padding: 12px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .onderdeel-naam {
        font-weight: 500;
        margin-bottom: 4px;
      }
      .onderdeel-actie {
        font-size: 12px;
        color: #64748b;
      }
      @media (max-width: 600px) {
        body { padding: 20px; }
        .offerte-container { padding: 24px; }
      }
    </style>
  </head>
  <body>
    <div class="offerte-container">
      <div class="header">
        <div class="logo">gligor<span style="color: #00e5ff;">.</span>xyz</div>
        <h1 style="font-family: 'Orbitron',sans-serif; font-weight: 800; margin: 16px 0 8px;">Offerte</h1>
        <p style="color: #64748b; font-size: 14px;">Valserij: ${g.valserij || "1"}</p>
      </div>

      <div class="section">
        <div class="section-title">Werkwaarden</div>
        <div class="field-row">
          <div><span class="field-label">Aannemer:</span><span class="field-value">${g.werknemerNaam || "[Uw naam]"}</span></div>
        </div>
        <div class="field-row">
          <div><span class="field-label">Adres:</span><span class="field-value">${g.werkwoordenAdres || "[Adres aannemer]"}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Klantgegevens</div>
        <div class="field-row">
          <div><span class="field-label">Naam:</span><span class="field-value">${g.clientNaam || "[Naam klant]"}</span></div>
        </div>
        <div class="field-row">
          <div><span class="field-label">Adres:</span><span class="field-value">${g.clientAdres || "[Adres klant]"}</span></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Omschrijving</div>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">${g.werkwijzeOmschrijving || "[Omschrijving van hoe te werk gaiden]"}</p>
      </div>

      <div class="section">
        <div class="section-title">Gegeven Onderdelen</div>
        ${Array.from(g.gekozenOnderdelen)
          .map((id) => {
            const onderdeel = onder.find((o) => o.id === id);
            return `
            <div class="onderdeel-row">
              <div class="onderdeel-naam">${onderdeel?.naam || id}</div>
              <div class="onderdeel-actie">${g.acties[id] || "[Actie opgeven...]"}</div>
            </div>`;
          })
          .join("")}
      </div>

      <div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.05); text-align: center; color: #64748b; font-size: 12px;">
        <p>Dit is een automatisch gegenereerde offerte. Prijzen komen later in de workflow.</p>
      </div>
    </div>
  </body>
  </html>
`;