# Bronnen en feitencontrole

Gecontroleerd vóór productie (november 2026). In deze build-omgeving konden de sites zelf niet direct worden geopend
(netwerkbeleid); de feiten zijn gecontroleerd via zoekresultaten die deze officiële pagina's citeren. Alle vier de
kernfeiten worden door meerdere bronnen bevestigd.

| Feit in de video | Bron(nen) |
|---|---|
| U.S. Open 2000, Pebble Beach: Tiger −12 (272), Ernie Els en Miguel Ángel Jiménez gedeeld tweede op +3 (287): **15 slagen** verschil, de grootste marge ooit in een major | USGA fact sheet: https://mediacenter.usga.org/press-releases?item=122709 · USGA/U.S. Open history: http://2012.usopen.com/en_US/champ_experience/history.html · U.S. Open: https://www.usopen.com/2025/articles/remembering-tiger-woods--historic-2000-u-s--open-triumph.html |
| **9 PGA Tour-zeges in 2000** (Mercedes Championships, AT&T Pebble Beach Pro-Am, Bay Hill, Memorial, U.S. Open, The Open, PGA Championship, WGC-NEC Invitational, Bell Canadian Open) | PGA Tour: https://www.pgatour.com/article/news/latest/2020/07/13/ranking-tiger-woods-nine-wins-2000-season · 2000 PGA Tour: https://en.wikipedia.org/wiki/2000_PGA_Tour · Tiger Woods 2000 results: https://sports.yahoo.com/tiger-woods-2000-event-results-164107352.html · https://tigerwoods.com/timeline/ |
| **Tiger Slam**: vier opeenvolgende majors, U.S. Open (juni 2000) → The Open (juli 2000) → PGA Championship (aug. 2000) → Masters (april 2001); alle vier de titels tegelijk in bezit, verspreid over twee kalenderjaren (dus géén Grand Slam binnen één kalenderjaar) | PGA Tour: https://www.pgatour.com/tiger-woods-chasing-82-wins-record-sam-snead-history/tiger-woods-chasing-82-the-tiger-slam-first-win-the-players-championship-four-straight-majors.html · PGA Tour (Masters): https://www.pgatour.com/article/news/latest/2023/04/03/tiger-woods-at-the-masters-25th-appearance-through-the-years |

Rekenkundige controle: −12 → +3 = 15 gelijke stappen (−12, −11, …, 0, +1, +2, +3 = 16 tegels, 15 tussenstappen).
De schaal in de video is een grafische weergave van het scoreverschil, geen afstand op de baan ("1 tegel = 1 slag verschil").

## Gebruikte middelen en licenties
- Beeld: volledig origineel, procedureel opgebouwd in three.js (geen externe modellen of textures).
- Stem: Piper TTS (MIT) met de Nederlandse stem `nl-rdh-medium` (dataset https://github.com/r-dh/dutch-vl-tts, CC0 1.0).
  Let op: dit is een Vlaams-Nederlandse stem.
- Muziek en geluidseffecten: volledig gesynthetiseerd in `audio/build_audio.py` (geen samples).
- Lettertypen: Inter en Barlow Condensed (SIL Open Font License 1.1, via @fontsource).
- Lens-blur shader: aangepast uit https://github.com/mromidev/claude-animated-shorts (MIT).
