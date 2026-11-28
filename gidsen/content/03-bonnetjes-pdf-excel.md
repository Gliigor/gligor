---
nummer: "03"
titel: Bonnetjes & PDF's naar Excel
ondertitel: Facturen, bonnetjes en PDF's laten uitlezen in plaats van overtypen
---

## In het kort

| | |
| --- | --- |
| **Voor wie** | Ondernemers die zelf hun administratie bijhouden, of gegevens uit PDF's overtypen (inkoopfacturen, werkbonnen, bestellingen, uren) |
| **Wat de klant krijgt** | Een vaste manier om een stapel PDF's of foto's in één keer in een nette tabel te krijgen, klaar voor Excel of de boekhouder |
| **Inrichttijd** | 1 tot 1,5 uur |
| **Richtlijn besparing** | 10 bonnetjes van 30 naar 8 minuten (inclusief controle) |

## 1. Eerst checken: doet het boekhoudpakket dit al?

Veel boekhoudpakketten (zoals Moneybird, e-Boekhouden, Exact, Yuki, SnelStart) lezen facturen en bonnetjes al automatisch in via een **mail-inbox of app**. Als de klant zo'n pakket heeft, is dat vaak de beste oplossing: dan zet je dat goed aan en leer je de klant het gebruiken.

AI is de juiste keuze als:

- de gegevens **niet** naar de boekhouding gaan (werkbonnen, bestellingen, urenlijsten, offertes van leveranciers vergelijken);
- de klant een **overzicht in Excel** wil (bijv. alle kosten per project of per maand);
- het pakket het niet kan, of de klant geen pakket heeft.

## 2. Vooraf verzamelen

- [ ] **10 echte voorbeelden**: een mix van PDF-facturen, foto's van bonnetjes en mails.
- [ ] Welke **kolommen** wil de klant? Hoe ziet hun huidige Excel eruit? Vraag het bestand.
- [ ] Welke **categorieën** gebruiken ze (materiaal, brandstof, telefoon, project X)?
- [ ] Waar komen de bestanden binnen (mail, WhatsApp, papier) en waar moeten ze heen?

## 3. Het vaste format (leg dit samen vast)

| Kolom | Voorbeeld | Regel |
| --- | --- | --- |
| Datum | 12-11-2026 | DD-MM-JJJJ |
| Leverancier | Technische Unie | Zoals op de factuur |
| Factuurnummer | F-2026-0418 | Leeg als er geen is |
| Omschrijving | Koperbuis 15 mm | Kort, max. 8 woorden |
| Bedrag excl. btw | 120,00 | Komma als decimaal |
| Btw % | 21 | 21, 9 of 0 |
| Btw-bedrag | 25,20 | |
| Totaal incl. btw | 145,20 | |
| Categorie | Materiaal | Alleen uit de vaste lijst |
| Project/klant | Jansen | Leeg als onbekend |
| Controle | OK / NAKIJKEN | NAKIJKEN als iets onleesbaar of onzeker is |

## 4. Inrichten in Claude

1. Maak een **Project** "Bonnetjes – {bedrijfsnaam}" met de instructies hieronder.
2. Voeg als kennis de lijst met categorieën en een voorbeeld van een goed ingevulde tabel toe.
3. Test met de 10 voorbeelden. Controleer elke regel tegen het origineel.

```prompt
Je leest facturen, bonnetjes en PDF's voor {bedrijfsnaam} en zet ze in een tabel.

Gebruik precies deze kolommen, in deze volgorde:
Datum | Leverancier | Factuurnummer | Omschrijving | Bedrag excl. btw | Btw % |
Btw-bedrag | Totaal incl. btw | Categorie | Project/klant | Controle

Regels:
- Eén regel per factuur of bonnetje (niet per artikel), tenzij ik anders vraag.
- Datum als DD-MM-JJJJ, bedragen met komma, zonder euroteken.
- Categorie alleen uit de lijst in de projectbestanden; twijfel = "Overig".
- Controleer: excl. + btw = totaal. Klopt dat niet, of is iets onleesbaar?
  Zet dan Controle op NAKIJKEN en vul niets zelf in.
- Verzin nooit gegevens.
Geef daarna een korte lijst van de regels met NAKIJKEN en waarom.
```

**Werkwijze voor de klant:** sleep de bestanden (of foto's) in het project, vraag om de tabel, en kopieer die naar Excel. Vraag eventueel om een **downloadbaar Excel- of CSV-bestand** als die functie beschikbaar is.

## 5. Inrichten in Microsoft 365 Copilot

1. Maak in **Copilot Chat** een agent "Bonnetjes {bedrijfsnaam}" met dezelfde instructies; zet de categorieënlijst in de gekoppelde map.
2. De klant uploadt de PDF's of foto's in de chat met de agent en vraagt om de tabel.
3. Kopieer de tabel naar het vaste **Excel-bestand** in OneDrive. In Excel kan Copilot daarna helpen met overzichten ("totaal per categorie per maand", "maak een draaitabel").

<div class="tip"><strong>Excel controleert mee.</strong> Zet in het Excel-bestand een formule die excl. + btw met het totaal vergelijkt, en een voorwaardelijke opmaak die NAKIJKEN rood kleurt. Dan valt een fout meteen op.</div>

## 6. Uitleggen aan de klant

> "Je verzamelt je bonnetjes en PDF's, sleept ze in de assistent en krijgt een tabel terug in precies de kolommen die je gewend bent. Staat er NAKIJKEN bij, dan was iets niet goed leesbaar: die kijk je even na tegen het origineel. De rest controleer je met een snelle blik: de totalen rekent Excel na. Je originelen bewaar je gewoon zoals altijd."

## 7. Meten

- Nulmeting: hoeveel stukken per maand, minuten per 10 stuks (overtypen en controleren).
- Na 2 en 4 weken: minuten per 10 stuks met AI, inclusief controle.
- Tel ook de fouten: hoeveel NAKIJKEN-regels, en hoeveel fouten vond de klant zelf?

## 8. Privacy en administratie

- Facturen bevatten bedrijfsgegevens, soms namen: gebruik een zakelijk account (zie Basisgids).
- **Originelen bewaren**: 7 jaar fiscale bewaarplicht. De tabel is een hulpmiddel, geen vervanging.
- Bij twijfel over btw of boeken: de boekhouder beslist, niet de AI.

## 9. Problemen en oplossingen

| Probleem | Oplossing |
| --- | --- |
| Slechte foto's worden verkeerd gelezen | Recht van boven fotograferen, goed licht, één bonnetje per foto; of scannen met de telefoon (Notities/Drive-app) |
| Btw verkeerd gesplitst bij gemengde tarieven | Regel toevoegen: "bij meerdere btw-tarieven één regel per tarief" |
| Kolommen schuiven bij plakken in Excel | Vraag om CSV met puntkomma's, of plak via "Plakken speciaal → Tekst" |
| Klant controleert niet meer | NAKIJKEN-regels verplicht nalopen; maandelijkse steekproef van 5 stuks afspreken |

## 10. Opleverchecklist

- [ ] Gecheckt of het boekhoudpakket dit al kan
- [ ] Kolommen en categorieën samen vastgelegd
- [ ] Project/agent ingericht, getest met 10 echte stukken, alle regels gecontroleerd
- [ ] Excel-bestand met controleformule en rode NAKIJKEN-opmaak
- [ ] Klant heeft zelf een stapel verwerkt in de training
- [ ] Nulmeting staat in het dashboard

<!-- spiekbriefje -->

# Bonnetjes & PDF's naar Excel

**Zo werkt het:** open de assistent *Bonnetjes*, sleep je PDF's of foto's erin en gebruik een van de vragen hieronder. Kopieer de tabel naar je vaste Excel-bestand.

### Alles in één tabel
```prompt
Zet deze bestanden in de tabel.
```

### Per artikel in plaats van per factuur
```prompt
Zet deze factuur in de tabel, met één regel per artikel.
```

### Overzicht maken
```prompt
Maak van deze tabel een overzicht: totaal per categorie per maand.
```

### Alleen één project
```prompt
Welke kosten horen bij project {naam}? Geef de regels en het totaal.
```

<div class="rules">

**Spelregels**

- Staat er **NAKIJKEN**? Vergelijk die regel met het origineel.
- Excel rekent de totalen na: een **rode regel** klopt niet.
- **Bewaar je originelen** gewoon (7 jaar voor de Belastingdienst).
- Twijfel over btw of boeken? Vraag het je boekhouder.
- Foto's: recht van boven, goed licht, één bonnetje per foto.

</div>
