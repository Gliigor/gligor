---
nummer: "04"
titel: Social media & reviews
ondertitel: Elke week posts in 20 minuten, en reviews beantwoorden zonder er tegenop te zien
---

## In het kort

| | |
| --- | --- |
| **Voor wie** | Bedrijven die zichtbaar willen zijn op Instagram, Facebook, LinkedIn of Google, maar er geen tijd voor hebben: bakkers, kappers, horeca, winkels, vakmensen |
| **Wat de klant krijgt** | Een vast weekritme: op één moment alle posts voor de week, in hun eigen toon; plus vaste antwoorden voor reviews |
| **Inrichttijd** | 1,5 uur |
| **Richtlijn besparing** | Posts van 2 uur naar 30 minuten per week; review van 10 naar 2 minuten |

## 1. Vooraf verzamelen

- [ ] Op welke **kanalen** zitten ze, en welke doet er echt toe? (Kies er maximaal twee plus Google.)
- [ ] **10 posts** die goed liepen of die ze mooi vinden (van henzelf of anderen).
- [ ] **Toon**: grappig of rustig, je of u, wel of geen emoji, hoeveel hashtags.
- [ ] Vaste **onderwerpen**: producten, seizoenen, achter de schermen, team, tips, acties.
- [ ] Toegang tot hun **Google Bedrijfsprofiel** (voor reviews).

## 2. Het weekritme (leg dit vast)

| Wanneer | Wat | Tijd |
| --- | --- | --- |
| Vast moment (bijv. vrijdag 16.00) | Foto's van de week bij elkaar zoeken, assistent maakt 3 posts | 20 min |
| Direct erna | Posts inplannen in Meta Business Suite (Instagram + Facebook) of LinkedIn | 10 min |
| Twee keer per week | Nieuwe reviews beantwoorden met de assistent | 5 min |

## 3. Inrichten in Claude

Maak een **Project** "Social media – {bedrijfsnaam}" met deze instructies; voeg de 10 voorbeeldposts en de lijst met onderwerpen toe als kennis.

```prompt
Je schrijft social-media-posts en antwoorden op reviews voor {bedrijfsnaam},
een {soort bedrijf} in {plaats}.

Toon: {je/u}, {warm/grappig/rustig}, zoals de voorbeeldposts in de projectbestanden.
Posts:
- Instagram/Facebook: 2 tot 4 korte zinnen, {0/1/2} emoji, maximaal {3} hashtags,
  altijd een lokale hashtag (#{plaats}).
- LinkedIn: zakelijker, 3 tot 5 zinnen, geen hashtags behalve 1 relevante.
- Eindig met een kleine uitnodiging (langskomen, reageren, bestellen), niet opdringerig.
- Verzin geen acties, prijzen of feiten die ik niet noem.

Reviews:
- Bedank met de voornaam (geen achternaam), noem iets concreets uit de review.
- Negatief: rustig, geen discussie in het openbaar, bied aan om te bellen of mailen.
- Maximaal 4 zinnen. Onderteken met {naam}.
```

## 4. Inrichten in Microsoft 365 Copilot

1. Maak in **Copilot Chat** een agent "Social media {bedrijfsnaam}" met dezelfde instructies en de voorbeeldposts in de gekoppelde map.
2. De klant uploadt een paar foto's en beschrijft kort wat erop staat; de agent schrijft de posts.
3. Voor een beeld zonder eigen foto kan Copilot een afbeelding maken. **Liever echte foto's**: die doen het beter en zijn eerlijker.

## 5. De vaste vragen

```prompt
Maak 3 posts voor deze week. Dit is er gebeurd: {korte beschrijving per foto}.
Geef per post: kanaal, tekst, en een tip voor de foto.
```

```prompt
Maak een planning voor de komende maand: 2 posts per week, met onderwerpen uit
onze lijst en de feestdagen/seizoenen van {maand}.
```

```prompt
Beantwoord deze review: {plak de review}
```

```prompt
Deze review is negatief: {plak de review}. Schrijf een rustig antwoord en bied aan om
te bellen. Geef ook een korte notitie voor mij: wat kunnen we hiervan leren?
```

## 6. Uitleggen aan de klant

> "Eén vast moment per week: je pakt de foto's die je hebt gemaakt, vertelt in een paar woorden wat erop staat, en je krijgt drie posts in jouw toon. Je plant ze in, en je bent de hele week klaar. Reviews beantwoord je twee keer per week met de assistent: bij een boze review blijft het antwoord rustig, en je nodigt de klant uit om te bellen."

Laat de klant in de training de posts voor de **komende week echt maken en inplannen**. Dan is de eerste week meteen gevuld.

## 7. Meten

- Nulmeting: tijd per week aan posts en reviews; hoeveel posts per week ze nu halen.
- Na 2 en 4 weken: tijd per week, en of ze het ritme hebben volgehouden.
- Extra (niet voor de garantie): bereik en reacties uit Meta Business Suite, aantal reviews.

## 8. Privacy en regels

- **Foto's van klanten of medewerkers** alleen met toestemming (AVG en portretrecht). Spreek dit af met het team.
- In review-antwoorden geen achternamen, geen details over de afspraak of de behandeling.
- Geen nepreviews en geen reviews "kopen": dat is misleidend en kan beboet worden.

## 9. Problemen en oplossingen

| Probleem | Oplossing |
| --- | --- |
| Posts klinken als reclame of "AI" | Meer echte voorbeeldposts toevoegen; regel: "geen woorden als 'ontdek', 'unieke', 'boost'" |
| Te veel hashtags en emoji | Vaste aantallen in de instructies (bijv. max. 3 hashtags, 1 emoji) |
| Ritme verwatert na 3 weken | Vast moment in de agenda zetten; bij de check-in samen de maandplanning maken |
| Geen foto's | Lijstje "foto-ideeën" op het spiekbriefje; elke dag één foto maken als gewoonte |

## 10. Opleverchecklist

- [ ] Kanalen gekozen (max. 2 + Google)
- [ ] Project/agent met instructies en 10 voorbeeldposts
- [ ] Vast weekmoment in de agenda van de klant
- [ ] Eerste week posts gemaakt en ingepland in de training
- [ ] Review-antwoord getest met een positieve en een negatieve review
- [ ] Nulmeting staat in het dashboard

<!-- spiekbriefje -->

# Social media & reviews

**Je vaste moment:** ______________ (bijv. vrijdag 16.00). Pak je foto's van de week, open de assistent *Social media* en kies een vraag. Plan de posts in, klaar.

### Posts voor deze week
```prompt
Maak 3 posts voor deze week. Dit is er gebeurd: {kort per foto}
```

### Planning voor de maand
```prompt
Maak een planning voor {maand}: 2 posts per week, met de feestdagen en het seizoen.
```

### Review beantwoorden
```prompt
Beantwoord deze review: {plak de review}
```

### Negatieve review
```prompt
Deze review is negatief: {plak de review}. Schrijf een rustig antwoord en bied aan om te bellen.
```

<div class="rules">

**Spelregels**

- Lees elke post na: klopt het, klinkt het als jou?
- Klanten of medewerkers op de foto? **Alleen met toestemming.**
- Bij een boze review: nooit in discussie, altijd uitnodigen om te bellen.
- **Foto-ideeën:** vers product, je team aan het werk, voor/na, een tevreden klant (met toestemming), een tip van de week.

</div>
