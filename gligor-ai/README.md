# gligor.ai

The one-page landing site for **Gligor.ai**: AI help for small businesses, €100 per month.
It's a static Astro and Tailwind CSS site, written in Dutch. There's no backend. The only
external service is the Cal.com booking embed, which loads only when a visitor scrolls near it.

It lives in its own folder, separate from the gligor.xyz site at the repository root.

## Run it

Requires Node 22.23.4 or newer.

```bash
cd gligor-ai
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
npm run preview    # serve dist/ locally
```

## Fill in before going live

Everything personal lives in **`src/config.ts`**:

| What | Where |
| --- | --- |
| Cal.com link (`CAL_LINK`, e.g. `gligor/kennismaking`) | `src/config.ts` |
| E-mail, WhatsApp number, LinkedIn URL | `src/config.ts` → `CONTACT` |
| Business name, address, KvK-nummer, btw-id | `src/config.ts` → `BUSINESS` |
| Personal sentence in "Over mij" | `src/config.ts` → `ABOUT_PERSONAL_LINE` |
| Photo | replace **`src/assets/gligor.jpg`** (portrait, about 4:5) |
| Privacy statement and terms (draft texts) | `src/pages/privacyverklaring.astro`, `src/pages/algemene-voorwaarden.astro` |

The photo goes in `src/assets/` (not `public/`) so Astro can turn it into small AVIF/WebP
versions automatically. A large photo straight from the camera is fine.

In Cal.com, create a 30-minute event type whose link matches `CAL_LINK`.

## Prepared for later (hidden)

- **Intro video**: set `SHOW_INTRO_VIDEO = true` and `INTRO_VIDEO_URL` (a YouTube/Vimeo embed URL, or an
  `.mp4` in `public/`). It replaces the photo in "Over mij", and the hero gets a link to it.
- **Trust section** (tool logos, certificates, testimonials): fill the lists in
  `src/components/Trust.astro` and set `SHOW_TRUST_SECTION = true`.

## Logo, favicon and share image

- `scripts/build-logo.mjs` builds the wordmark from Plus Jakarta Sans ExtraBold as plain SVG paths, with a
  blue-to-teal spark replacing the dot of the "i". It writes `src/components/logo-data.json`,
  `public/logo.svg` (standalone, for e-mail signatures and documents) and `public/favicon.svg`.
- `scripts/generate-assets.mjs` (`npm run assets`) renders `og-image.png`, the PNG icons, `favicon.ico`
  and, if there is no photo yet, the placeholder photo. It needs Playwright with Chromium.

## Structure

```
src/config.ts            all placeholders and feature flags
src/pages/index.astro    page order of all sections
src/components/          one component per section (Hero, PainPoints, Demo, Services,
                         Calculator, Pricing, Steps, About, Trust, Faq, Booking, Footer)
src/scripts/             browser logic: demo animation, calculator, Cal.com loader, scroll reveal
src/styles/global.css    colours, font, shared styles, animations
```

Notes:
- Animations use IntersectionObserver and switch off entirely under `prefers-reduced-motion`.
  Without JavaScript, all content stays visible.
- The font is self-hosted (no Google Fonts request), and there are no cookies or trackers.
- Calculator: `monthly = hours/week × 4.33 × rate × people`, `net = monthly − 100`,
  `break-even hours = 100 / rate`.

## Deploy

Any static host works. On Vercel, for example:
1. Import this repository as a new project and set **Root Directory** to `gligor-ai`
   (Astro is detected automatically: build `npm run build`, output `dist`).
2. Add the domain `gligor.ai` under Project → Settings → Domains.

Netlify and Cloudflare Pages work the same way (base directory `gligor-ai`, publish `dist`).
