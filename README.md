# HAZWOPER Course Generator

Enter a course name and duration, review/edit an AI-drafted outline, then generate a full slide
deck (text, AI images, real-world examples) as a downloadable **.pptx** and a **SCORM 1.2**
package ready to upload to the Hazwoper Osha Training LMS.

Built with Next.js (App Router) on Vercel, Postgres (via Neon), Vercel Blob, the OpenAI API
(outline + slide text), and the Gemini API (slide images).

## One-time setup

### 1. Create accounts / provision services

You'll need:

- An **OpenAI API key** (platform.openai.com) for outline and slide text generation (defaults to
  `gpt-5` — set `OPENAI_TEXT_MODEL` for a different model).
- A **Gemini API key** (aistudio.google.com/apikey) for slide images (defaults to
  `gemini-2.5-flash-image` — set `GEMINI_IMAGE_MODEL` for a different model).
- A **Vercel account**, with this repo connected as a project (`vercel.com/new`, import from
  GitHub).
- A **Postgres database**. In the Vercel dashboard, go to your project's **Storage** tab and add
  a Postgres integration (Neon). This automatically wires `DATABASE_URL` into your Vercel
  environment variables.
- A **Vercel Blob store**. Same Storage tab, add a Blob store. This wires `BLOB_READ_WRITE_TOKEN`
  automatically.

### 2. Environment variables

Copy [`.env.local.example`](.env.local.example) to `.env.local` for local development, and set
the same variables in Vercel's Project Settings → Environment Variables for production:

| Variable | Notes |
|---|---|
| `APP_PASSWORD` | Shared password required to use the app. Pick something you can share with anyone who needs access. |
| `SESSION_SECRET` | Random secret for signing the session cookie. Generate with `openssl rand -hex 32`. |
| `OPENAI_API_KEY` | Server-side only — never sent to the browser. |
| `OPENAI_TEXT_MODEL` | Defaults to `gpt-5`. |
| `GEMINI_API_KEY` | Server-side only — never sent to the browser. |
| `GEMINI_IMAGE_MODEL` | Defaults to `gemini-2.5-flash-image`. |
| `DATABASE_URL` | Auto-set by the Neon integration on Vercel; for local dev, copy it from the Vercel dashboard or use a local Postgres. |
| `BLOB_READ_WRITE_TOKEN` | Auto-set by the Blob integration on Vercel; for local dev, copy it from the Vercel dashboard. |

### 3. Database migrations

```bash
npm run db:generate   # generate SQL migrations from lib/db/schema.ts (only needed after schema changes)
npm run db:migrate    # apply migrations to DATABASE_URL
npm run db:seed       # seed the single generation_locks row (required once)
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

### 5. Deploy

Push to GitHub and import the repo on Vercel (or `git push` if already connected). Vercel builds
and deploys automatically; make sure the environment variables above are set for the Production
environment before your first deploy.

## How it works

1. **New course** (`/courses/new`) — enter a name + duration. This calls OpenAI once to draft an
   outline (modules → topics).
2. **Outline review** (`/courses/[id]/outline`) — approve it, or send it back with free-text
   feedback; each revision is saved as a new version so nothing is lost.
3. **Generate** (`/courses/[id]/generate`) — once approved, the browser claims a global
   generation lock (only one course can generate at a time, across all users/devices) and loops
   through the course one slide at a time: OpenAI writes the slide text, then Gemini generates
   an image; both get saved. If the page is closed mid-generation, the lock self-releases after
   ~90 seconds and you can resume from where it left off.
4. **Download** (`/courses/[id]/download`) — once every slide is generated, build the `.pptx` and
   the SCORM 1.2 `.zip` on demand. Upload the `.zip` to the LMS.

## Notes / known limitations

- Image generation cost adds up (roughly 15–80 images per course depending on duration) — there's
  no cost estimate shown yet before you commit to a full generation run.
- The SCORM package has been structured against the SCORM 1.2 spec and a hand-rolled API adapter,
  but hasn't been verified against the real Hazwoper Osha Training LMS yet — test-upload a short
  course first before relying on it for a real course, since LMS SCORM importers vary in
  strictness beyond what the spec alone guarantees.
- The image-generation moderation fallback degrades a slide to text-only if Gemini's safety
  filter rejects both the original and a sanitized prompt — check the generation progress page
  for any slides that ended up without an image.
