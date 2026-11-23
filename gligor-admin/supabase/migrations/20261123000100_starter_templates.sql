-- Startsjablonen (Nederlands). Gligor kan ze daarna aanpassen in "Templates".
-- Variabelen: {{voornaam}}, {{naam}}, {{bedrijf}}, {{pakket}}, {{maandbedrag}}, {{startdatum}},
-- en bij de betaalherinnering ook {{bedrag}}, {{omschrijving}}, {{vervaldatum}}.

insert into email_templates (key, name, stage, subject, body, sort) values
(
  'welkom', 'Welkom na kennismaking', 'intake',
  'Fijn kennisgemaakt, {{voornaam}}!',
  $t$Hoi {{voornaam}},

Dank je wel voor het fijne gesprek. Leuk om te horen hoe het er bij {{bedrijf}} aan toe gaat, en ik denk echt dat AI je daar tijd kan besparen.

Zoals besproken plannen we nu de intake. Daarin kijken we samen naar je werkdag: waar gaat de tijd naartoe, en wat kan AI overnemen? Neem gerust een paar voorbeelden mee van mails, offertes of documenten waar je veel tijd aan kwijt bent.

Je zit op het pakket {{pakket}} ({{maandbedrag}} per maand, maandelijks opzegbaar). Daar komt eenmalig het startbedrag bij voor de inrichting en de starttraining. En met de tijdbespaargarantie loop je geen risico.

Vragen? Mail of app gerust.

Hartelijke groet,
Gligor$t$,
  10
),
(
  'bevestiging_intake', 'Bevestiging intake', 'inrichting',
  'Wat we hebben afgesproken bij de intake',
  $t$Hoi {{voornaam}},

Dank voor de intake. Hieronder kort wat we hebben afgesproken, zodat we allebei hetzelfde voor ogen hebben.

Wat ik ga doen:
- De AI-tools voor {{bedrijf}} inrichten
- Spiekbriefjes op maat maken voor jullie eigen werk
- De starttraining voorbereiden

Wat ik van jou nodig heb:
- Toegang tot de accounts die we besproken hebben (of een moment waarop we dat samen doen)
- Een paar voorbeelden van terugkerend werk

Je startdatum is {{startdatum}}. Ik laat het weten zodra alles klaarstaat.

Groet,
Gligor$t$,
  20
),
(
  'inrichting_klaar', 'Inrichting klaar + spiekbriefjes', 'training',
  'Alles staat klaar, {{voornaam}}',
  $t$Hoi {{voornaam}},

Goed nieuws: de AI-tools voor {{bedrijf}} zijn ingericht. In de bijlage vind je de spiekbriefjes met kant-en-klare werkwijzen voor jullie eigen werk. Print ze gerust uit en leg ze naast het toetsenbord.

Tijdens de starttraining lopen we alles samen door, met jullie eigen voorbeelden. Daarna kun je meteen aan de slag.

Tot snel!
Gligor$t$,
  30
),
(
  'checkin_2w', 'Check-in na 2 weken', 'training',
  'Hoe gaat het met AI bij {{bedrijf}}?',
  $t$Hoi {{voornaam}},

Je werkt nu zo'n twee weken met de AI-tools. Hoe bevalt het?

Ik ben benieuwd:
- Welke taken gaan al sneller?
- Waar loop je nog tegenaan?
- Is er iets wat je vaker doet en waar we een spiekbriefje voor kunnen maken?

Een korte reactie is genoeg. Liever even bellen? Laat maar weten wanneer het uitkomt.

Groet,
Gligor$t$,
  40
),
(
  'garantie_4w', 'Garantie-evaluatie na 4 weken', 'checkin',
  'Tijd voor de check-in: wat heeft het je opgeleverd?',
  $t$Hoi {{voornaam}},

Je eerste maand zit erop. Tijd om samen te kijken wat AI je heeft opgeleverd.

Zoals beloofd meten we de besparing samen. Bespaar je minder dan 4 uur, terwijl je de training hebt gevolgd en de tools gebruikt? Dan krijg je je startbedrag volledig terug.

Wil je alvast nadenken over:
- Welke taken je nu sneller doet, en hoeveel tijd dat ongeveer scheelt
- Wat je nog graag slimmer zou willen doen

Ik plan een kort moment met je in. Komt het je deze week uit?

Groet,
Gligor$t$,
  50
),
(
  'kwartaal_update', 'Kwartaal-update (Plus)', 'doorlopend',
  'Kwartaal-update: welk proces pakken we nu aan?',
  $t$Hoi {{voornaam}},

Er is weer een kwartaal voorbij. Met je Plus-pakket pakken we elk kwartaal samen een nieuw proces aan bij {{bedrijf}}.

Waar ben je op dit moment de meeste tijd aan kwijt? Denk aan offertes, administratie, klantvragen of social media. Laat het me weten, dan kom ik met een voorstel.

Ook deel ik graag kort welke nieuwe AI-functies voor jou interessant zijn.

Groet,
Gligor$t$,
  60
),
(
  'betaalherinnering', 'Vriendelijke betaalherinnering', null,
  'Herinnering: {{omschrijving}}',
  $t$Hoi {{voornaam}},

Een vriendelijke herinnering: ik heb de betaling voor "{{omschrijving}}" van {{bedrag}} (vervaldatum {{vervaldatum}}) nog niet binnen.

Waarschijnlijk is het er gewoon even bij ingeschoten. Zou je ernaar willen kijken? Heb je het al betaald, dan kun je deze mail negeren.

Dank je wel!
Gligor$t$,
  70
)
on conflict (key) do nothing;
