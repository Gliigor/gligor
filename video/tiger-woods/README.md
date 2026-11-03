# Hoe goed was Tiger Woods? — 50 s animated short

Vertical (1080 × 1920, 30 fps, exactly 50 s) Dutch mini-documentary about Tiger Woods' dominance in 2000–2001,
rendered with three.js inside Remotion (`@remotion/three`), built on the workflow of
[mromidev/claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) but with 3D miniature figures
and a diorama course instead of 2D cards (brief takes precedence over the template's style and length).

## Deliverables (`deliverables/`)
- `tiger_woods_met_ondertitels.mp4` — final, with sound and burned-in Dutch subtitles
- `tiger_woods_zonder_ondertitels.mp4` — same, without burned-in subtitles
- `tiger_woods_ondertitels_nl.srt` — subtitle file
- Sources and licences: `SOURCES.md`

## Story timeline
| s | scene | key beats |
|---|---|---|
| 0–5 | hook | Tiger at the top of his swing → impact → camera follows the ball over the diorama; "HOE GOED WAS TIGER?" |
| 5–15 | proof | scoreboard U.S. OPEN · 2000; rows flip in on the voice; "LAGER = BETER"; −12 vs +3; the chasers slump |
| 15–23 | 15 steps | push into −12 → match-dissolve onto Tiger's −12 tile; tiles −12…+3 rise; camera counts 15 equal steps |
| 23–30 | nine wins | tiles fly into a 3×3 grid and flip to the nine 2000 wins (U.S. Open first) |
| 30–42 | Tiger Slam | the three 2000 majors + the 2001 Masters on a 2000 \| 2001 timeline; trophies appear, gather around Tiger |
| 42–50 | close | back on the scale, Tiger in red in front, chasers at +3; fist; "15 SLAGEN VOORSPRONG."; ends on frame 0 (loop) |

## Layout
- `src/` — Remotion project: `Video.tsx` (canvases, post chain, crossfades), `Overlay.tsx` (titles + subtitles),
  `world/` (`World.ts` story/camera, `figure.ts` IK figures + golf swing, `course.ts` diorama, `props.ts`
  scoreboard/tiles/trophies, `look.ts` palette and painted textures), `lensblur.ts`, `grade.ts`, `lib/cues.ts`
  (all timings derive from the measured voice-over in `src/timeline.json`).
- `voice/` — `segments.json` (spoken text + subtitle text), `synth.py` (Piper), `build_voice.py` (timeline, SRT).
- `audio/` — `build_audio.py` (score, SFX, ducking, mix), `master.sh` (−14 LUFS), `cues.md` (every sound event).

## Rebuild
```bash
npm install
# voice (needs piper-tts and the nl-rdh-medium voice from github.com/rhasspy/piper/releases/tag/v0.0.2)
python voice/synth.py /path/to/nl-rdh-medium.onnx 1.12 && python voice/build_voice.py && cp voice/voice.wav public/audio/
# sound
python audio/build_audio.py && ./audio/master.sh
# picture (software WebGL in a container: --gl=swangle; on a desktop GPU use --gl=angle)
npx remotion render src/index.ts TigerShortClean out/picture_clean.mp4 --codec=h264 --crf=16 --concurrency=4 --gl=swangle --timeout=300000 --props='{"subs":false,"audio":null}'
# subtitles on transparency
npx remotion render src/index.ts SubsOnly out/subs_overlay.mov --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le --image-format=png --props='{"subs":true,"audio":null,"titles":false,"world":false}'
# assemble
./deliver.sh
```
One-pass alternative (renders the 3D twice as long but needs no assembly):
`npx remotion render src/index.ts TigerShort out/final.mp4 --gl=swangle --timeout=300000` (uses `public/audio/mix.wav`).

Preview / edit: `npx remotion studio src/index.ts`. Test stills: `node stills.mjs out/stills/x_ 0,300,900 0.5`.
