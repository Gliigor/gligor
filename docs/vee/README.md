# Vee: the friendly AI helper (tryout)

Vee lives inside the gligor.xyz codebase at the route `/#/vee`. This folder
holds the plain-language notes for each build phase.

- [Phase 1: Skeleton](./phase-1-skeleton.md) (done)
- Phase 2: Character (next)
- Phase 3: Onboarding
- Phase 4: First tools (Notion notes, Gmail triage, daily summary)
- Phase 5: Voice
- Phase 6: Calendar and restaurant search
- Phase 7: Proactive layer and privacy page

## How the pieces fit

```
browser (React page at src/pages/Vee.tsx)
   │  POST /api/chat  (JSON in, streamed text out)
   ▼
Vercel serverless function (api/chat.ts)
   │  picks "quick brain" or "deep brain"  (api/_lib/router.ts)
   │  calls the model through ONE interface (api/_lib/model.ts)
   ▼
Anthropic Claude API   ← the API key only ever lives here, on the server
```

Folder map:

| Path | What it is |
| --- | --- |
| `api/chat.ts` | The chat endpoint. Validates input, routes, streams the reply. |
| `api/health.ts` | Tiny status endpoint to check the deployment is configured. |
| `api/_lib/model.ts` | `callModel()` / `streamModel()`: the only file that talks to Claude. |
| `api/_lib/models.ts` | Which model is used for which kind of task. Change models here. |
| `api/_lib/router.ts` | Decides quick vs deep model per message. |
| `api/_lib/prompts.ts` | Vee's personality (system prompt). |
| `api/_lib/plans.ts` | Free/paid limits in one place (not enforced yet). |
| `src/pages/Vee.tsx` | The chat screen. |
| `src/vee/api.ts` | Browser code that calls the backend and reads the stream. |
| `src/vee/VeeAvatar.tsx` | Placeholder character (Phase 2 replaces it). |

Folders under `api/` that start with `_` are helpers; Vercel does not turn
them into public URLs.
