# ✦ Constellation

**An AI-powered career guide that turns your skills and interests into a living night sky.**

Upload your CV (or answer three quick questions) and Constellation charts an interactive constellation: your core skills anchor the center, realistic career paths orbit them as glowing stars, and ambitious "stretch careers" sit at the rim. Click any star for personalized AI guidance, ask the built-in Sky Guide chatbot anything about your results, and download your sky as a shareable image.

Built as a final-year portfolio project — a single Next.js app, deployable to Vercel with one link, no separate backend and no database.

---

## Features

- **Two input paths** — drag-and-drop CV upload (PDF/DOCX, parsed and extracted by AI) or a guided questions form; both converge on an editable review screen before anything is generated
- **AI-generated constellation** — Gemini maps your profile into a validated node/edge graph (core skills → careers → stretch careers, no orphan nodes)
- **Cinematic rendering** — d3-force layout, glowing/twinkling stars, traveling pulses along connections, animated path tracing from any career back through your skills, zoom/pan/pinch, parallax depth layers
- **Star detail panel** — per-star AI guidance: why it fits you, concrete next steps, one resource to start
- **Sky Guide chat** — floating assistant with your full constellation as context ("compare my top two paths", "what should I learn first?")
- **Progress tracking** — your latest sky is saved in `localStorage`; regenerating shows a "Your Sky Is Expanding" diff (new / kept / faded stars)
- **3 themes** — Nebula Violet, Solar Amber, Aurora Teal — instant switching via CSS variables, persisted across visits
- **Export & share** — download a watermarked PNG of your sky, or copy an AI-written share blurb
- **Achievement toasts** — small cosmetic delights (exploring a stretch star, deep-diving in chat)

Every AI call degrades gracefully: missing key, network failure, or invalid model output falls back to local engines or friendly error states — the app never dead-ends.

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router), single deployment |
| API layer | Next.js API routes only (no separate backend) |
| Frontend | React, Tailwind CSS, Framer Motion |
| Graph layout | `d3-force` (link / charge / center / collide / x / y) |
| LLM | Google Gemini (server-side only, JSON output mode) |
| File parsing | `pdf-parse` (PDF), `mammoth` (DOCX) |
| Persistence | Browser `localStorage` (no accounts, no DB) |

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your key (below)
npm run dev                  # http://localhost:3000
```

### Adding your Gemini key

1. Create a free API key at <https://aistudio.google.com/apikey>
2. Put it in `.env.local`:

   ```
   GEMINI_API_KEY=your_real_key_here
   ```

3. Restart the dev server.

Optional: override the model with `GEMINI_MODEL` (defaults to `gemini-flash-lite-latest`).

The key is read **server-side only** (inside API routes) and is never shipped to the client. `.env.local` is gitignored. **Without a key the app still runs end-to-end** using local fallback engines (keyword CV scan, rule-based constellation, templated guidance) and tells the user so — handy for offline demos.

### Production build

```bash
npm run build && npm start
```

## Deploying to Vercel

1. Push the repo to GitHub/GitLab
2. In [Vercel](https://vercel.com): **Add New → Project → import the repo** (framework auto-detected as Next.js — no config needed)
3. Under **Settings → Environment Variables**, add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`)
4. Deploy — you get one shareable link; API routes run as serverless functions automatically

## Architecture summary

Single-page flow driven by a state machine in `src/components/App.tsx`:

```
landing → input (CV upload | questions) → review (editable chips)
        → generating (loader) → [expansion comparison, if a saved sky exists]
        → constellation view  ⇄  star detail panel / Sky Guide chat
```

There is intentionally no client-side routing — one page, animated screen transitions, plus five serverless API routes.

### API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/parse-cv` | POST | Accepts a PDF/DOCX (≤5MB), extracts text server-side (`pdf-parse` / `mammoth`), then Gemini extracts `{skills[], interests[], experience_level}` — only what's actually present. Falls back to a local keyword scan. |
| `/api/generate-constellation` | POST | Takes the confirmed profile, returns `{nodes[], edges[]}` (3–5 core skills, 4–6 careers, 2–3 stretch careers). Output is schema-validated server-side — counts, id normalization, value clamping, and a BFS connectivity check (no orphans). Retries once on invalid output, then falls back to a rule-based local generator. |
| `/api/star-detail` | POST | Takes a clicked node + profile + its connected skills, returns `{why_it_fits, next_steps[], resource_suggestion}`. Retries once; local template fallback. |
| `/api/chat` | POST | Sky Guide chat. Receives the message, prior turns (client React state only — resets on refresh), and the full constellation context, which is injected as the system prompt so answers are grounded in the user's actual results. |
| `/api/share-summary` | POST | One small Gemini call producing a ≤55-word first-person share blurb of the top matches; templated fallback. |

### Key modules

| Path | Role |
| --- | --- |
| `src/components/App.tsx` | Screen state machine, generation orchestration, achievement toasts |
| `src/components/ConstellationView.tsx` | d3-force simulation, SVG rendering, hover/trace/zoom/pan/select, PNG export |
| `src/components/StarDetailPanel.tsx` / `ChatWidget.tsx` | AI guidance surfaces |
| `src/components/Starfield.tsx` | Ambient canvas starfield (twinkle, parallax, shooting stars) |
| `src/lib/constellation.ts` | Graph schema, validation, connectivity checking |
| `src/lib/storage.ts` | `localStorage` persistence + sky diffing (`unchanged / new / removed`) |
| `src/lib/gemini.ts` | Server-only Gemini client (JSON + chat modes) |
| `src/lib/*-fallback.ts` | Local engines used when the AI is unavailable |

### Persistence & theming

- `constellation:latest` — latest sky (`{version, savedAt, profile, data}`); powers "View my previous sky", the expansion diff, and "Last updated" / "Clear my saved sky"
- `constellation:theme` — selected theme; applied pre-hydration to avoid flash. All theme identity lives in CSS variables (`globals.css`), so switching is instant

### Dev utilities

`node scripts/make-test-cv.js` generates `test-cv.pdf` — a realistic sample CV for testing the upload flow without real documents.
