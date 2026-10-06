# Phase 1: Skeleton

**Goal:** a working chat box that talks to Claude through a backend, with
automatic routing between a cheap model and Claude Opus. The API key never
touches the browser.

## What was built

- **Backend on Vercel** (`api/` folder). Vercel turns each file into a small
  server function. There are two: `/api/chat` (the conversation) and
  `/api/health` (a status check).
- **One model interface.** `api/_lib/model.ts` is the only file that imports
  the Anthropic SDK. Everything else says "call the model for task X" and
  this file decides the details. Swapping models later is a one-line change
  in `api/_lib/models.ts`.
- **Routing.** For each message, Vee first asks the cheap model a one-word
  question ("simple or complex?"). Simple goes to Claude Haiku 4.5, complex
  goes to Claude Opus 5.5. The UI shows which "brain" answered, and a toggle
  lets you force either one for testing.
- **Streaming.** Replies appear word by word.
- **Mock mode.** With no API key, the backend returns canned replies so the
  UI can be tested for free. The page shows a "mock mode" badge.
- **Access code (optional).** Set `VEE_ACCESS_CODE` on Vercel and visitors
  must enter it once. Not real sign-in (that is Phase 3), just a lock on your
  API budget while the link is public.
- **Local dev without Vercel.** `npm run dev` serves the `api/` functions
  too, so the chat works on your machine.

## What you need to do (one time)

### 1. Get an Anthropic API key

1. Go to <https://console.anthropic.com/> and sign in or create an account.
2. Add a small amount of credit under **Billing** (a few euros is plenty for
   testing; Haiku replies cost fractions of a cent).
3. Go to **API keys**, click **Create key**, name it `vee-tryout`, and copy
   it. You only see it once.

### 2. Deploy the project on Vercel

1. Go to <https://vercel.com/new>, sign in with GitHub, and import the
   `gligor` repository.
2. Vercel will detect Vite automatically. Leave build settings as they are
   (`vercel.json` in the repo already tells it what to do).
3. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `ANTHROPIC_API_KEY` | the key from step 1 |
   | `VEE_ACCESS_CODE` | any word you like, e.g. `blobs-rule` (optional but recommended) |

4. Click **Deploy**. After a minute you get a URL like
   `https://gligor-xxxx.vercel.app`.
5. Open `https://<your-url>/#/vee`.

Vercel redeploys automatically on every push to `main`, and creates a
preview URL for every pull request. That is the "green button" flow: I push,
you open the preview, you merge if you like it.

### 3. Domain (optional, when you are ready)

gligor.xyz currently deploys from GitHub Pages. GitHub Pages cannot run the
`api/` functions, so Vee only works on the Vercel URL for now. Two options:

- **Simplest:** move the whole site to Vercel. In Vercel, **Settings →
  Domains**, add `gligor.xyz`, and update the DNS records it shows you. Then
  the GitHub Pages workflow can be deleted.
- **Keep Pages:** keep gligor.xyz on GitHub Pages and set
  `VITE_VEE_API_BASE=https://<your-vercel-url>` as a build variable for the
  Pages build. Vee on gligor.xyz would then call the Vercel backend. (This
  needs a small CORS addition on the backend; say so and I will add it.)

My recommendation is the first option, so everything lives in one place.

### 4. Run it on your own computer (optional)

```sh
cp .env.example .env.local      # then paste your key into ANTHROPIC_API_KEY
npm install
npm run dev
```

Open <http://localhost:8080/#/vee>. Leave the key empty to use mock mode.

## Test checklist

- [ ] `https://<your-url>/api/health` shows `"ok": true` and
      `"hasApiKey": true`. If `"mock": true`, the key is missing on Vercel.
- [ ] Open `/#/vee`. If you set an access code, the page asks for it once.
- [ ] Type "hi" and send. A short friendly reply streams in, labelled
      **quick brain**.
- [ ] Ask something bigger, e.g. "Plan a simple three-day trip to Lisbon with
      a rough budget". The reply should be labelled **deep brain**.
- [ ] Switch the toggle to **Quick**, ask the same question, and confirm the
      label says quick brain. Switch to **Deep** and confirm the opposite.
- [ ] Press the square stop button during a long reply. It stops.
- [ ] Ask "can you read my email?" Vee should say it can't yet.
- [ ] Open the page on your phone. The input stays reachable above the
      keyboard.

## Cost note

Each "auto" message costs one tiny Haiku call (the classifier) plus the real
reply. Haiku replies are roughly $0.001 each; Opus replies are typically
$0.02 to $0.10 depending on length. The routing exists so most chatter stays
on the cheap side.

## Decisions I made that you may want to change

- **Opus effort is set to "medium".** Good balance for chat-style tasks.
  Can be raised for the agent tools in Phase 4.
- **No conversation memory on the server.** The browser sends the full
  conversation each time and nothing is stored anywhere. That matches the
  privacy promise; sign-in (Phase 3) will add minimal storage.
- **Conversation limit:** 40 messages and 8,000 characters per message, to
  keep costs bounded.
