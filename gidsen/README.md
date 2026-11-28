# Implementatiegidsen

Per workflow een gids voor Gligor (inrichten in Claude én Microsoft 365 Copilot, prompts, uitleg aan de klant, meten, privacy, problemen) met als laatste pagina een spiekbriefje voor de klant.

| Bestand | Inhoud |
| --- | --- |
| `pdf/00-basis.pdf` | Wat bij elke klant hetzelfde is: omgeving kiezen, opbouw, prompts, AVG, meten voor de garantie, starttraining |
| `pdf/01-offertes-emails.pdf` | Offertes en e-mails in de eigen toon, met de eigen prijslijst |
| `pdf/02-whatsapp-klantvragen.pdf` | Vaste vragen via WhatsApp Business (niveau 1) en wanneer een chatbot (niveau 2) |
| `pdf/03-bonnetjes-pdf-excel.pdf` | Facturen, bonnetjes en PDF's uitlezen naar Excel |
| `pdf/04-social-media-reviews.pdf` | Weekritme voor posts en reviews beantwoorden |
| `pdf/*-spiekbriefje.pdf` | Alleen het spiekbriefje, om te printen of naar de klant te sturen |

## Aanpassen

De tekst staat in `content/*.md` (gewone Markdown). Alles na `<!-- spiekbriefje -->` wordt de klantpagina. Prompts staan in een blok met ```` ```prompt ````; `{velden}` worden groen.

```bash
npm install
npm run build
```

Het bouwen gebruikt Playwright (Chromium) en het lettertype en logo uit `../gligor-ai` (daar eerst `npm install`).
