---
nummer: "02"
titel: WhatsApp & klantvragen
ondertitel: Vaste vragen sneller en beter beantwoorden, zonder dat de klant 's avonds blijft appen
---

## In het kort

| | |
| --- | --- |
| **Voor wie** | Bedrijven met veel dezelfde vragen via WhatsApp, mail of telefoon: kappers, bakkers, garages, sportscholen, winkels, verhuurders |
| **Wat de klant krijgt** | Een complete set vaste antwoorden in hun eigen toon, slim ingesteld in WhatsApp Business, plus een assistent voor de lastige vragen |
| **Inrichttijd** | 1,5 uur (niveau 1); een echte chatbot (niveau 2) is een apart project |
| **Richtlijn besparing** | 30 tot 60 minuten per dag bij 20+ vragen per dag |

## 1. Kies het niveau

Begin **altijd met niveau 1**. Pas als dat goed loopt én er heel veel vragen binnenkomen, kijk je naar niveau 2.

| | Niveau 1: slimme vaste antwoorden | Niveau 2: AI-chatbot op WhatsApp |
| --- | --- | --- |
| Wat | WhatsApp Business met snelle antwoorden, begroetings- en afwezigheidsbericht, catalogus; AI schrijft de antwoorden en helpt bij lastige vragen | Een bot die zelf antwoordt, via het WhatsApp Business-platform (API) van Meta |
| Nodig | Gratis WhatsApp Business-app | Een aanbieder (partner van Meta), bedrijfsverificatie bij Meta, kosten per gesprek |
| Past bij | Bijna iedereen | Veel vragen per dag (50+), vaak buiten openingstijden |
| Risico | Klein: de mens verstuurt | Fout antwoord gaat direct naar de klant; goed testen en beperken |

<div class="tip"><strong>Niet te veel beloven.</strong> Niveau 1 levert het meeste op voor de minste moeite. Een chatbot op WhatsApp kost meer tijd, geld en onderhoud. Bied die apart aan, met een eigen offerte.</div>

## 2. Vooraf verzamelen

- [ ] De **20 vragen die het vaakst binnenkomen** (laat de klant een week lang turven, of scroll samen door hun WhatsApp).
- [ ] Openingstijden, prijzen, adres, parkeren, betaalmethoden, annuleringsregels.
- [ ] Hoe ze nu antwoorden: 5 echte voorbeelden (toon, emoji ja/nee, je of u).
- [ ] Wie antwoordt er (één telefoon of meerdere mensen)?

## 3. Niveau 1 inrichten

**Stap 1: de antwoordenbank maken met AI**

Maak in Claude een **Project** "Klantvragen – {bedrijfsnaam}" (of in Copilot een agent) met deze instructies en de verzamelde informatie als kennis:

```prompt
Je bent de klantenservice-assistent van {bedrijfsnaam}, een {soort bedrijf} in {plaats}.
Je schrijft antwoorden op vragen van klanten namens {naam}.

Toon: {je/u}, warm en kort, zoals een appje. Maximaal 3 zinnen. {wel/geen} emoji.
Gebruik alleen informatie uit de projectbestanden (openingstijden, prijzen, regels).
Weet je iets niet zeker? Schrijf dan: "Dat zoek ik even voor je uit, ik laat het je vandaag weten."
Maak nooit afspraken, kortingen of beloftes die niet in de bestanden staan.
```

Laat AI daarna voor alle 20 vragen een kort antwoord schrijven:

```prompt
Schrijf voor elk van deze vragen een kort WhatsApp-antwoord in onze toon.
Geef een tabel met: snelkoppeling (één woord), vraag, antwoord.
{plak de 20 vragen}
```

**Stap 2: WhatsApp Business instellen** (op de telefoon van de klant, samen doen)

1. Zet het nummer over naar de **WhatsApp Business**-app als dat nog niet zo is (de chats blijven bewaard; maak eerst een back-up).
2. **Bedrijfsprofiel**: openingstijden, adres, website, korte omschrijving.
3. **Snelle antwoorden**: voer de antwoorden uit stap 1 in met hun snelkoppeling. De klant typt dan "/prijzen" en het antwoord staat klaar.
4. **Begroetingsbericht** voor nieuwe klanten en **afwezigheidsbericht** buiten openingstijden ("Bedankt voor je bericht! We zijn er weer om 9.00 uur. Veel antwoorden vind je op {website}.").
5. Eventueel: **catalogus** met de diensten en prijzen, en **labels** (nieuwe klant, afspraak, betaald).

**Stap 3: lastige vragen**

Voor vragen die niet in de snelle antwoorden staan: kopieer de vraag naar het project of de agent, en laat een antwoord voorstellen. Na het lezen plakt de klant het terug in WhatsApp.

<div class="tip"><strong>Elke vraag die twee keer langskomt, wordt een snel antwoord.</strong> Spreek af dat de klant die vragen even noteert; bij de check-in voeg je ze toe.</div>

## 4. Niveau 2 (chatbot): waar je op let

- Kies een aanbieder die officieel met het WhatsApp Business-platform werkt, data in de EU kan houden en een verwerkersovereenkomst aanbiedt.
- De bot mag **alleen** antwoorden uit de vaste informatie, en moet doorverwijzen naar een mens bij twijfel, klachten en alles over geld.
- Zet in het eerste bericht dat het een **automatisch antwoord** is (verplicht volgens de Europese AI-verordening).
- Test met 30 echte vragen vóór livegang, en lees de eerste twee weken alle gesprekken mee.

## 5. Uitleggen aan de klant

> "Alles wat je steeds opnieuw typt, staat nu klaar onder een snelkoppeling. Typ een slash en het woord, en het antwoord staat er. Buiten openingstijden krijgt de klant automatisch een nette reactie. Krijg je een lastige vraag? Plak hem in de assistent, die stelt een antwoord voor in jouw toon. Jij beslist wat er verstuurd wordt."

## 6. Meten

- Nulmeting: aantal berichten per dag, tijd per dag aan antwoorden (ook 's avonds!).
- Na 2 en 4 weken: dezelfde vragen, en: hoeveel avonden per week appte je nog?
- Extra: hoeveel snelle antwoorden zijn er gebruikt (WhatsApp Business toont dit niet; laat de klant schatten).

## 7. Privacy

- Gesprekken blijven in WhatsApp; in de AI-assistent plak je alleen de vraag, niet de naam of het nummer van de klant.
- Geen medische of gevoelige informatie in snelle antwoorden of in de assistent.
- Bij een chatbot: verwerkersovereenkomst met de aanbieder, en vermelden in de privacyverklaring van de klant.

## 8. Problemen en oplossingen

| Probleem | Oplossing |
| --- | --- |
| Antwoorden te lang of te stijf | Toon-regel aanscherpen: "maximaal 3 zinnen, zoals een appje"; 3 echte appjes als voorbeeld toevoegen |
| Klant vergeet de snelkoppelingen | Korte, logische woorden (/open, /prijs, /adres) en het spiekbriefje bij de kassa of op het bureau |
| Verkeerde openingstijden in antwoord | Eén bron van waarheid: het bedrijfsprofiel en het kennisbestand tegelijk bijwerken (ook bij feestdagen) |
| Meerdere medewerkers antwoorden verschillend | Dezelfde snelle antwoorden op elke telefoon, of overstappen naar een gedeelde inbox (apart project) |

## 9. Opleverchecklist

- [ ] Antwoordenbank met minstens 15 vragen, door de klant goedgekeurd
- [ ] Bedrijfsprofiel, snelle antwoorden, begroetings- en afwezigheidsbericht ingesteld
- [ ] Project/agent voor lastige vragen ingericht en getest
- [ ] Klant heeft zelf 5 snelle antwoorden gebruikt in de training
- [ ] Nulmeting staat in het dashboard

<!-- spiekbriefje -->

# Klantvragen sneller beantwoorden

**Zo werkt het:** in WhatsApp Business typ je een slash (/) en de snelkoppeling; het antwoord staat klaar. Lees het, pas het eventueel aan, en verstuur.

<div class="shortcuts">

| Typ | Voor |
| --- | --- |
| /open | Openingstijden |
| /prijs | Prijzen |
| /adres | Adres en parkeren |
| /afspraak | Afspraak maken |
| /betalen | Betaalmethoden |
| /annuleren | Annuleringsregels |
| ............ | ................................ |
| ............ | ................................ |

</div>

### Lastige vraag? Vraag het de assistent
```prompt
Schrijf een kort antwoord op deze vraag van een klant: {plak de vraag}
```

### Klacht beantwoorden
```prompt
Een klant is ontevreden: {plak het bericht}. Schrijf een rustig, vriendelijk antwoord.
Bied aan om te bellen. Geen excuses voor dingen die we niet zeker weten.
```

<div class="rules">

**Spelregels**

- Jij verstuurt, niet de computer. **Lees elk antwoord even na.**
- Geen namen, telefoonnummers of medische informatie in de assistent plakken.
- Komt een vraag vaker terug? Schrijf hem op: dan wordt het een nieuwe snelkoppeling.
- Openingstijden veranderd (feestdagen)? Pas het bedrijfsprofiel en de snelle antwoorden aan.

</div>
