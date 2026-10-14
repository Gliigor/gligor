// "Aandachtspunten": deterministic rules that turn a calculated plan into
// points worth discussing with the client. They read the engine's input and
// output only, so they keep working when calculatePlan() is swapped for a
// licensed rekenkern. Thresholds live in src/lib/engine/assumptions.ts.
//
// Texts are client-facing (they appear in the PDF report), in Dutch, "u"-form.

import { ASSUMPTIONS } from "@/lib/engine/assumptions";
import type { PlanInput, PlanResult } from "@/lib/engine/types";
import { formatEuro, formatPercent } from "@/lib/format";
import { progressiveTax } from "@/lib/engine/tax-math";

export type InsightTone = "kans" | "aandacht" | "info";
export type InsightCategory = "belasting" | "vermogen" | "pensioen" | "zakelijk";

export interface Insight {
  /** Stable key, used to hide an insight from the report. */
  id: string;
  tone: InsightTone;
  category: InsightCategory;
  title: string;
  body: string;
  /** Optional indicative amount, e.g. a yearly saving or a shortfall. */
  amount?: { value: number; label: string };
}

export const INSIGHT_TONE_LABELS: Record<InsightTone, string> = {
  kans: "Kans",
  aandacht: "Aandacht",
  info: "Ter info",
};

const euro = (n: number) => formatEuro(n, { whole: true });
const TONE_ORDER: Record<InsightTone, number> = { aandacht: 0, kans: 1, info: 2 };

export function deriveInsights(input: PlanInput, result: PlanResult): Insight[] {
  const s = input.scope;
  const a = ASSUMPTIONS.insights;
  const out: Insight[] = [];

  const company = input.zakelijk.companies[0];
  const dgaSalary = result.income.dgaSalary;
  const dividend = result.income.dividendReceived;
  const expenses = result.income.expenses;
  const savings = s.box3 ? input.prive.box3.filter((i) => i.category === "savings").reduce((x, i) => x + i.value, 0) : 0;
  const h = input.household;
  const hasPartner = s.partner && h.partner !== null;
  const fiscal = result.household.fiscalPartners;
  const mortgage = result.wealth.prive.mortgageDebt;
  const box3 = result.taxes.lines.find((l) => l.box === 3);
  const box2FirstBracket = ASSUMPTIONS.box2.brackets[0].upTo ?? Infinity;
  const combinedDividendRate = a.vpb.lowRate + (1 - a.vpb.lowRate) * ASSUMPTIONS.box2.brackets[0].rate;

  // --- Zakelijk / salary vs dividend ----------------------------------------
  if (s.bv && company) {
    if (dgaSalary <= 0) {
      out.push({
        id: "dga-geen-salaris",
        tone: "aandacht",
        category: "zakelijk",
        title: "Geen salaris uit de BV",
        body: `Als directeur-grootaandeelhouder moet u in principe een gebruikelijk loon ontvangen (indicatief ${euro(a.gebruikelijkLoon)} per jaar). Ontbreekt dat, dan kan de Belastingdienst een loon vaststellen.`,
      });
    } else if (dgaSalary < a.gebruikelijkLoon) {
      out.push({
        id: "dga-salaris-onder-gebruikelijk-loon",
        tone: "aandacht",
        category: "zakelijk",
        title: "Salaris onder het gebruikelijk loon",
        body: `Het salaris uit de BV (${euro(dgaSalary)}) ligt onder het gebruikelijk loon van ${euro(a.gebruikelijkLoon)}. Een lager loon is alleen toegestaan als aannemelijk is dat het past bij de onderneming, bijvoorbeeld bij verlies of een beperkte omvang.`,
        amount: { value: a.gebruikelijkLoon - dgaSalary, label: "Verschil met gebruikelijk loon" },
      });
    } else if (dgaSalary > a.gebruikelijkLoon) {
      // Exact comparison for the DGA: box 1 saved on the excess salary versus
      // corporate tax plus box 2 on the same amount paid out as dividend.
      const dga = result.household.persons.find((p) => p.dgaSalary > 0);
      const excess = dgaSalary - a.gebruikelijkLoon;
      if (dga) {
        const gross = dga.grossEmployment + dga.dgaSalary;
        const box1Saved = progressiveTax(gross, ASSUMPTIONS.box1.brackets) - progressiveTax(gross - excess, ASSUMPTIONS.box1.brackets);
        const dividendCost = excess * combinedDividendRate;
        const saving = box1Saved - dividendCost;
        if (saving > 500) {
          out.push({
            id: "dga-salaris-vs-dividend",
            tone: "kans",
            category: "belasting",
            title: "Salaris of dividend?",
            body: `Het deel van het salaris boven het gebruikelijk loon (${euro(excess)}) kost nu ${euro(box1Saved)} inkomstenbelasting (gemiddeld ${formatPercent(box1Saved / excess)}). Dezelfde winst als dividend uitkeren kost samen ongeveer ${formatPercent(combinedDividendRate)} (vennootschapsbelasting plus box 2). Let op: een lager salaris heeft ook gevolgen voor bijvoorbeeld pensioenopbouw en de hypotheekruimte. Vergelijk dit bij Keuzes vergelijken.`,
            amount: { value: saving, label: "Indicatief verschil per jaar" },
          });
        }
      }
    }
  }

  const box2Threshold = box2FirstBracket * (fiscal ? 2 : 1);
  if (s.dividend && dividend > box2Threshold) {
    const above = dividend - box2Threshold;
    const extra = above * ((ASSUMPTIONS.box2.brackets[1]?.rate ?? 0) - ASSUMPTIONS.box2.brackets[0].rate);
    out.push({
      id: "box2-hoog-tarief",
      tone: "kans",
      category: "belasting",
      title: "Dividend valt deels in het hoge box 2-tarief",
      body: fiscal
        ? `Ook verdeeld over u beiden valt ${euro(above)} van het dividend boven de grens van ${euro(box2FirstBracket)} per persoon en wordt belast tegen het hoge tarief. Door de uitkering over meerdere jaren te spreiden, blijft meer in het lage tarief.`
        : `Van het dividend valt ${euro(above)} boven de grens van ${euro(box2FirstBracket)} en wordt belast tegen het hoge tarief. Door de uitkering over meerdere jaren te spreiden${hasPartner ? "" : ", of te verdelen met een fiscaal partner"}, blijft meer in het lage tarief.`,
      amount: { value: extra, label: "Extra belasting door hoog tarief" },
    });
  }

  // --- Gezin -------------------------------------------------------------------
  if (hasPartner && h.relation === "samenwonend") {
    out.push({
      id: "geen-fiscaal-partner",
      tone: "aandacht",
      category: "belasting",
      title: "Samenwonend zonder fiscaal partnerschap",
      body: "Zonder fiscaal partnerschap kunnen inkomen uit de BV en box 3-vermogen niet vrij tussen u beiden worden verdeeld, en geldt bij overlijden het hoge erfbelastingtarief. Met een notarieel samenlevingscontract (met een wederzijdse pensioenverevening) wordt u fiscaal partner.",
    });
  }

  if (result.gifts) {
    for (const child of result.gifts.perChild) {
      if (child.giftTax > 0) {
        out.push({
          id: `schenking-belast-${child.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}`,
          tone: "aandacht",
          category: "vermogen",
          title: `Schenking aan ${child.name} boven de vrijstelling`,
          body: `In ${result.gifts.year} wordt ${euro(child.amount)} aan ${child.name} geschonken; de vrijstelling is ${euro(child.exemption)}. Over ${euro(child.taxable)} betaalt ${child.name} schenkbelasting. Spreiden over meerdere jaren kan dit voorkomen.`,
          amount: { value: child.giftTax, label: `Schenkbelasting (betaald door ${child.name})` },
        });
      }
    }
  }

  if (s.kinderen && h.children.length > 0 && box3 && box3.tax > 0 && (result.gifts?.totalThisYear ?? 0) === 0) {
    const yearly = h.children.length * ASSUMPTIONS.schenking.vrijstellingKind;
    out.push({
      id: "schenken-kans",
      tone: "kans",
      category: "vermogen",
      title: "Belastingvrij schenken aan uw kinderen",
      body: `U kunt elk kind jaarlijks ${euro(ASSUMPTIONS.schenking.vrijstellingKind)} belastingvrij schenken. Dat verlaagt uw box 3-vermogen en daarmee de box 3-heffing, en verkleint later de erfenis waarover erfbelasting wordt geheven.`,
      amount: { value: yearly, label: "Belastingvrij per jaar (alle kinderen)" },
    });
  }

  if (s.kinderen) {
    const year = result.referenceYear;
    const eligible = h.children.filter(
      (c) =>
        c.birthYear !== null &&
        year - c.birthYear >= ASSUMPTIONS.schenking.eenmaligMinAge &&
        year - c.birthYear <= ASSUMPTIONS.schenking.eenmaligMaxAge &&
        !h.gifts.some((g) => g.childName === c.name && g.kind === "eenmalig_verhoogd"),
    );
    if (eligible.length > 0) {
      out.push({
        id: "eenmalig-verhoogd",
        tone: "info",
        category: "vermogen",
        title: "Eenmalig verhoogde vrijstelling",
        body: `${eligible.map((c) => c.name).join(" en ")} ${eligible.length === 1 ? "valt" : "vallen"} in de leeftijd van 18 tot 40 jaar. Eenmalig kan dan ${euro(ASSUMPTIONS.schenking.eenmaligVerhoogd)} belastingvrij worden geschonken (in plaats van de jaarlijkse vrijstelling in dat jaar).`,
      });
    }
  }

  if (s.balans && result.wealth.zakelijk.liquidAssets > a.bvExcessCash) {
    out.push({
      id: "bv-ruime-liquiditeit",
      tone: "info",
      category: "zakelijk",
      title: "Ruime liquide middelen in de BV",
      body: `De BV houdt ${euro(result.wealth.zakelijk.liquidAssets)} aan liquide middelen aan. Leg vast waar dit geld voor bedoeld is (investeringen, buffer, pensioen). Overtollige middelen kunnen binnen de BV belegd worden of gefaseerd als dividend worden uitgekeerd.`,
    });
  }

  if (s.pensioenEigenBeheer && result.wealth.zakelijk.pensionObligation > 0) {
    const odv = result.wealth.zakelijk.pensionObligation;
    const cash = result.wealth.zakelijk.liquidAssets;
    if (s.balans && cash < odv) {
      out.push({
        id: "odv-dekking",
        tone: "aandacht",
        category: "pensioen",
        title: "Oudedagsverplichting niet gedekt door liquide middelen",
        body: `De oudedagsverplichting (${euro(odv)}) is groter dan de liquide middelen van de BV (${euro(cash)}). Zorg dat de BV de uitkeringen straks kan betalen, bijvoorbeeld door minder winst uit te keren.`,
        amount: { value: odv - cash, label: "Niet gedekt" },
      });
    }
  }

  // --- Vermogen / box 3 ------------------------------------------------------
  const buffer = (expenses / 12) * a.bufferMonths;
  if (s.box3 && s.inkomen && expenses > 0 && savings < buffer) {
    out.push({
      id: "buffer-te-klein",
      tone: "aandacht",
      category: "vermogen",
      title: "Financiële buffer is klein",
      body: `Het spaargeld (${euro(savings)}) is minder dan ${a.bufferMonths} maanden uitgaven (${euro(buffer)}). Een buffer voorkomt dat u bij tegenvallers moet verkopen of lenen.`,
      amount: { value: buffer - savings, label: "Aanvulling tot buffer" },
    });
  }

  if (s.box3 && s.eigenWoning && mortgage > 0 && savings > Math.max(buffer, 0)) {
    const excess = Math.min(savings - buffer, mortgage);
    const woning = input.prive.eigenWoning;
    const interest = woning ? woning.mortgages.reduce((sum, m) => sum + m.amount * (m.interestRate / 100), 0) : 0;
    const avgRate = mortgage > 0 ? interest / mortgage : 0;
    const netInterestSaving = excess * avgRate * (1 - ASSUMPTIONS.box1.hypotheekrenteAftrekTarief);
    const box3Saving =
      box3 && box3.tax > 0 ? Math.min(excess, result.taxes.box3.taxableBase) * ASSUMPTIONS.box3.forfaitBanktegoeden * ASSUMPTIONS.box3.tarief : 0;
    const saving = netInterestSaving + box3Saving;
    if (excess > 5_000 && saving > 250) {
      out.push({
        id: "aflossen-met-spaargeld",
        tone: "kans",
        category: "vermogen",
        title: "Aflossen met spaargeld",
        body: `Er staat ${euro(excess)} meer op de spaarrekening dan nodig is voor een buffer. Daarmee de hypotheek (gemiddelde rente ${formatPercent(avgRate)}) aflossen bespaart netto rente en box 3-heffing. Let op: afgelost geld is minder snel beschikbaar en boetevrij aflossen is vaak beperkt tot 10 à 20% per jaar.`,
        amount: { value: saving, label: "Indicatieve besparing per jaar" },
      });
    }
  }

  if (s.box3 && result.taxes.box3.base > 0 && result.taxes.box3.taxableBase === 0) {
    out.push({
      id: "box3-onder-vrijstelling",
      tone: "info",
      category: "belasting",
      title: "Geen box 3-heffing",
      body: `Het vermogen in box 3 blijft onder het heffingsvrij vermogen van ${euro(result.taxes.box3.exemption)}. Er is daarom geen box 3-belasting verschuldigd.`,
    });
  }

  if (box3 && box3.tax > 0) {
    out.push({
      id: "box3-tegenbewijs",
      tone: "info",
      category: "belasting",
      title: "Werkelijk rendement lager dan het forfait?",
      body: `De box 3-heffing (${euro(box3.tax)}) is gebaseerd op een fictief rendement. Was het werkelijke rendement lager, dan kunt u via de tegenbewijsregeling om een lagere heffing vragen. Ook groene beleggingen zijn tot een bepaald bedrag vrijgesteld.`,
    });
  }

  // --- Pensioen --------------------------------------------------------------
  const birthYear = h.client.birthYear;
  const aowPerPerson = hasPartner ? ASSUMPTIONS.aow.samenwonend : ASSUMPTIONS.aow.alleenstaand;
  const persons = [{ p: h.client, self: true }, ...(hasPartner && h.partner ? [{ p: h.partner, self: false }] : [])];
  for (const { p, self } of persons) {
    if (!s.pensioen || !p.retirementAge || p.retirementAge >= ASSUMPTIONS.aow.age) continue;
    const years = ASSUMPTIONS.aow.age - p.retirementAge;
    out.push({
      id: self ? "aow-gat" : "aow-gat-partner",
      tone: "aandacht",
      category: "pensioen",
      title: self ? "Periode zonder AOW" : `Periode zonder AOW voor ${p.name}`,
      body: `${self ? (hasPartner ? `${p.name} wil` : "U wilt") : `${p.name} wil`} stoppen op ${p.retirementAge}-jarige leeftijd, maar de AOW start pas rond ${ASSUMPTIONS.aow.age}. Gedurende ${years} jaar moet dit inkomen zelf worden overbrugd, bijvoorbeeld uit box 3-vermogen of de BV.`,
      amount: { value: years * aowPerPerson, label: "Te overbruggen AOW (bruto)" },
    });
  }

  if (s.pensioen && s.inkomen && expenses > 0 && result.retirement.retirementYear) {
    const net = (result.retirement.pensionPerYear + result.retirement.aowPerYear) * (1 - ASSUMPTIONS.box1.pensionerRate);
    const gap = expenses - net;
    if (gap > 1_000) {
      out.push({
        id: "pensioen-tekort",
        tone: "info",
        category: "pensioen",
        title: "Inkomen na pensionering",
        body: `Na pensionering (${result.retirement.retirementYear}) dekken pensioen en AOW netto ongeveer ${euro(net)} van de huidige uitgaven van ${euro(expenses)}. Het verschil komt uit vermogen of uit de BV. Bij de keuzes in Plannr kunt u vergelijken welke bron daarvoor het voordeligst is.`,
        amount: { value: gap, label: "Jaarlijks aan te vullen (vandaag)" },
      });
    }
  }

  const depletedYear = result.projection.summary.depletedYear;
  if (depletedYear) {
    const age = birthYear ? depletedYear - birthYear : null;
    out.push({
      id: "vermogen-uitgeput",
      tone: "aandacht",
      category: "vermogen",
      title: "Vrij beschikbaar vermogen raakt op",
      body: `In het neutrale scenario zijn spaargeld, beleggingen en de liquide middelen van de BV rond ${depletedYear}${age ? ` (leeftijd ${age})` : ""} op. Overweeg later te stoppen, uitgaven te verlagen of meer op te bouwen.`,
    });
  }

  if (birthYear === null) {
    out.push({
      id: "geboortejaar-ontbreekt",
      tone: "info",
      category: "pensioen",
      title: "Projectie zonder pensioenmoment",
      body: "Zonder geboortejaar houdt de projectie geen rekening met pensionering en AOW.",
    });
  }

  return out.sort((x, y) => TONE_ORDER[x.tone] - TONE_ORDER[y.tone]);
}
