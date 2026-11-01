import type { StepKey } from "@/lib/plan/definitions";

/** The question and the one short line at the top of each step. */
export function stepCopy(
  step: StepKey,
  names: { client: string; partner: string | null; hasCompany: boolean },
): { title: string; lead?: string } {
  const c = names.client;
  switch (step) {
    case "documenten":
      return { title: `Heb je stukken van ${c}?`, lead: "Een IB-aangifte of jaarrekening vult de volgende vragen alvast in. Geen stukken? Sla deze stap over." };
    case "client":
      return { title: `Over ${c}`, lead: `Leeftijd en wanneer ${c} wil stoppen met werken.` };
    case "partner":
      return { title: "Is er een partner?", lead: `Kies Nee om alleen met ${c} te rekenen.` };
    case "kinderen":
      return { title: "Zijn er kinderen?", lead: "Met kinderen kun je schenkingen plannen." };
    case "inkomen":
      return {
        title: names.partner ? `Wat verdienen ${c} en ${names.partner}?` : `Wat verdient ${c}?`,
        lead: names.hasCompany ? "Bruto per jaar, zonder salaris uit de eigen BV." : "Bruto per jaar, zoals op de jaaropgaaf.",
      };
    case "pensioen":
      return { title: "Welk pensioen is er opgebouwd?", lead: "Bruto per jaar vanaf de pensioendatum. De AOW rekent Plannr zelf." };
    case "posten":
      return { title: "Verandert er iets in de tijd?", lead: "Inkomsten of uitgaven met een eigen begin en eind, zoals studiekosten of een erfenis." };
    case "uitgaven":
      return { title: "Wat geeft het huishouden uit?", lead: "Per jaar, inclusief woonlasten." };
    case "woning":
      return { title: "Is er een eigen woning?", lead: "Een koopwoning waarin het huishouden zelf woont." };
    case "vermogen":
      return { title: "Welk vermogen is er?", lead: "Spaargeld, beleggingen, ander vastgoed en schulden." };
    case "zakelijk":
      return { title: "Hoe zit het bedrijf in elkaar?", lead: "Opgebouwd zoals de jaarrekening." };
    case "uitgangspunten":
      return { title: "Met welke uitgangspunten rekenen we?", lead: "Alle percentages op één plek. Leeg laten: de grijze standaardwaarde van het kantoor." };
    case "resultaten":
      return { title: "Resultaten" };
    case "rapport":
      return { title: "Rapport", lead: "Kies wat de cliënt te zien krijgt." };
  }
}
