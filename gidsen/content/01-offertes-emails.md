---
nummer: "01"
titel: Offertes & e-mails
ondertitel: Concept-offertes en antwoorden in de eigen toon van de klant, met hun eigen prijslijst
---

## In het kort

| | |
| --- | --- |
| **Voor wie** | Bedrijven die elke week offertes maken of veel mail beantwoorden: installateurs, schilders, aannemers, schoonmaak, dienstverleners |
| **Wat de klant krijgt** | Een vaste assistent die van aantekeningen of een klantmail een nette concept-offerte of antwoord maakt, in hun eigen stijl |
| **Inrichttijd** | 1,5 tot 2 uur (plus de starttraining) |
| **Richtlijn besparing** | Offerte van 45 naar 15 minuten; mail van 10 naar 3 minuten |

## 1. Vooraf verzamelen

Vraag de klant om dit vóór de inrichting te sturen of klaar te zetten:

- [ ] **Prijslijst** of tarieven (uurtarief, vaste prijzen, materialen, voorrijkosten). Een Excel of PDF is prima.
- [ ] **3 tot 5 recente offertes** die ze goed vonden, inclusief de opmaak (Word-sjabloon met logo).
- [ ] **Algemene voorwaarden** en vaste zinnen (geldigheid, betaaltermijn, garantie).
- [ ] **10 typische mails** met het antwoord dat ze gaven (vragen over prijs, planning, klachten).
- [ ] **Toon**: je of u? Kort of uitgebreid? Wat zeggen ze nooit?

## 2. Inrichten in Claude

1. Maak een **Project**: "Offertes en mail – {bedrijfsnaam}".
2. Zet de **instructies** hieronder in de projectinstructies en vul de {velden} in.
3. Voeg de **kennis** toe: prijslijst, voorbeeldoffertes, voorwaarden, de 10 voorbeeldmails.
4. Test met 3 echte aanvragen. Pas de instructies aan tot het resultaat klopt.

```prompt
Je bent de schrijfassistent van {bedrijfsnaam}, een {soort bedrijf} in {plaats}.
Je schrijft offertes en e-mails namens {naam eigenaar}.

Toon: {je/u}, vriendelijk en zakelijk, korte zinnen, geen jargon.
Nooit: overdreven beloftes, uitroeptekens, Engelse woorden als er een Nederlands woord is.

Offertes:
- Gebruik altijd de prijzen uit de prijslijst in de projectbestanden. Verzin nooit prijzen.
  Staat iets er niet in? Zet dan [PRIJS NAVRAGEN] en noem het onderaan.
- Volg de opbouw van de voorbeeldoffertes: aanhef, situatie, wat we doen, prijstabel,
  planning, voorwaarden, afsluiting.
- Bedragen excl. btw, btw apart, totaal incl. btw. Reken het totaal voor, maar zet erbij:
  "Totalen controleren".
- Geldigheid: {30} dagen. Betaaltermijn: {14} dagen.

E-mails:
- Beantwoord precies de vraag, in maximaal 6 zinnen.
- Eindig met een duidelijke volgende stap (afspraak, offerte, bellen).
- Onderteken met: {ondertekening}.

Vraag om ontbrekende informatie in plaats van te gokken.
```

## 3. Inrichten in Microsoft 365 Copilot

1. Zet de kennisbestanden in één map in OneDrive of SharePoint: "AI – Offertes".
2. Maak in **Copilot Chat** een **agent** ("Offerte-assistent {bedrijfsnaam}"). Plak dezelfde instructies als hierboven en koppel de map als kennisbron.
3. **In Word**: open het offertesjabloon van de klant en laat Copilot een concept maken. Verwijs naar de prijslijst en een voorbeeldofferte als bronbestand.
4. **In Outlook**: gebruik *Concept met Copilot* voor nieuwe mails en de antwoordsuggesties bij binnenkomende mail. Laat de klant de toon (kort, formeel) instellen.
5. Sla de vaste vragen uit hoofdstuk 4 op als **opgeslagen prompts**, zodat de klant ze met één klik terugvindt.

<div class="tip"><strong>Totalen in Excel, niet in AI.</strong> Laat de klant het eindbedrag altijd narekenen, of houd de prijstabel in Excel/Word met formules. AI kan zich verrekenen.</div>

## 4. De vaste vragen (kopieer naar het spiekbriefje)

```prompt
Maak een offerte van deze aantekeningen:
{plak hier je aantekeningen van het bezoek}
```

```prompt
Maak een offerte op basis van deze klantmail. Vraag eerst wat je mist.
{plak hier de mail}
```

```prompt
Schrijf een antwoord op deze mail. Kort, en stel een afspraak voor op {dag}.
{plak hier de mail}
```

```prompt
Schrijf een vriendelijke herinnering voor de offerte die ik {aantal} dagen geleden stuurde
aan {klant}. Vraag of ze nog vragen hebben.
```

```prompt
Maak deze tekst korter en zakelijker, maar houd hem vriendelijk:
{plak hier de tekst}
```

## 5. Uitleggen aan de klant

Gebruik ongeveer deze woorden in de training:

> "Je typt of plakt wat je weet, de assistent maakt er een nette offerte van met jouw prijzen en jouw opbouw. Jij leest hem na, past aan wat niet klopt, en verstuurt hem zelf. Klopt er iets niet in de prijslijst, dan zet hij er [PRIJS NAVRAGEN] bij in plaats van te gokken. Hoe meer je hem gebruikt, hoe beter we de instructies kunnen maken."

Laat de klant in de training **twee echte offertes** maken van aanvragen die nog openstaan. Dan hebben ze meteen resultaat.

## 6. Meten

- Nulmeting: aantal offertes en mails per week, minuten per stuk (inclusief opzoeken van prijzen).
- Na 2 en 4 weken: dezelfde vragen. Vraag ook: hoeveel moest je nog aanpassen?
- Extra bewijs: tijd tussen aanvraag en verstuurde offerte (sneller = meer opdrachten).

## 7. Privacy

- Klantnamen en adressen in een offerte zijn normaal; ze staan in de zakelijke omgeving van de klant.
- Geen BSN, geen bankgegevens van klanten, geen medische informatie (bijv. bij aanpassingen voor ouderen: "aangepaste badkamer", niet de diagnose).

## 8. Problemen en oplossingen

| Probleem | Oplossing |
| --- | --- |
| Verzint prijzen | Regel "Verzin nooit prijzen" bovenaan zetten; prijslijst als tabel aanleveren, niet als foto |
| Klinkt niet als de klant | Twee echte mails van de klant als voorbeeld toevoegen; "nooit"-lijst uitbreiden |
| Te lange offertes | Vorm vastleggen: "maximaal één A4", en een korte voorbeeldofferte toevoegen |
| Totaal klopt niet | Prijstabel in Word/Excel met formules; AI alleen voor de tekst |
| Oude prijzen | Eén prijslijst in de kennis, oude versies verwijderen; datum in de bestandsnaam |

## 9. Opleverchecklist

- [ ] Project/agent met instructies en kennis staat klaar
- [ ] Getest met 3 echte aanvragen, prijzen gecontroleerd
- [ ] Opgeslagen prompts of spiekbriefje met de 5 vaste vragen
- [ ] Klant heeft zelf 2 offertes gemaakt in de training
- [ ] Nulmeting staat in het dashboard

<!-- spiekbriefje -->

# Offertes & e-mails met AI

**Zo werkt het:** open het project *Offertes en mail* (Claude) of de *Offerte-assistent* (Copilot), plak wat je weet en kies een van de vragen hieronder. Lees altijd na voordat je iets verstuurt.

### Offerte van aantekeningen
```prompt
Maak een offerte van deze aantekeningen: {plak je aantekeningen}
```

### Offerte van een klantmail
```prompt
Maak een offerte op basis van deze klantmail. Vraag eerst wat je mist. {plak de mail}
```

### Mail beantwoorden
```prompt
Schrijf een antwoord op deze mail. Kort, en stel een afspraak voor op {dag}. {plak de mail}
```

### Herinnering na een offerte
```prompt
Schrijf een vriendelijke herinnering voor de offerte aan {klant} van {aantal} dagen geleden.
```

### Tekst verbeteren
```prompt
Maak deze tekst korter en zakelijker, maar houd hem vriendelijk: {plak de tekst}
```

<div class="rules">

**Spelregels**

- Controleer **altijd** de prijzen en het totaal.
- Staat er **[PRIJS NAVRAGEN]**? Vul die prijs zelf in.
- Geen BSN, bankgegevens of medische informatie invoeren.
- Werkt iets niet goed? Stuur het voorbeeld naar Gligor, dan passen we de instructies aan.

</div>
