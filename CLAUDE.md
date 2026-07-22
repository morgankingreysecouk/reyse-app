# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Next.js dev server on :3000
npm run build    # Production build (also type-checks)
npm run start    # prisma migrate deploy && next start -- runs pending migrations before serving
npm run lint     # ESLint (flat config, includes TypeScript + React Compiler rules)
```

`postinstall` runs `prisma generate` automatically, so a fresh `npm install` always has a matching client.

## Architecture

Next.js 16 App Router, deployed on Railway (not Vercel) as `app.reyse.co.uk` — the admin dashboard for Reyse.

### Auth

NextAuth v4, Google OAuth, JWT sessions, single hardcoded admin-email allowlist in `src/lib/auth.ts` — no roles table. Route protection is `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts`; the old `next-auth/middleware` wrapper isn't a valid proxy export on 16, so it's written directly against `getToken`). The matcher protects everything except `/login`, `/api/auth/*`, `/api/public/*`, and static assets. `(dashboard)/layout.tsx` does a second, server-rendered session check so a protected page never flashes unauthenticated.

### Database — Prisma 7, driver adapters are mandatory

Prisma 7 changed connection config significantly from v6 — **do not** put `url = env("DATABASE_URL")` in the `datasource` block in `schema.prisma`; the CLI rejects it (`P1012`, "no longer supported in schema files"). Instead:
- `prisma.config.ts` carries the connection string for the CLI (`migrate`, `generate`, `studio`) via `datasource: { url: process.env["DATABASE_URL"] }`.
- The generator is `provider = "prisma-client"` (not the old `prisma-client-js`), output to `src/generated/prisma` (gitignored, regenerated on every install). **The import path is `@/generated/prisma/client`, not `@/generated/prisma`** — there's no root `index.ts`, only `client.ts`.
- At runtime, `PrismaClient` requires a driver adapter — there is no more "just works from schema" direct connection. `src/lib/db.ts` constructs `new PrismaPg({ connectionString: process.env.DATABASE_URL })` from `@prisma/adapter-pg` and passes it as `new PrismaClient({ adapter })`. Omitting the adapter fails at the `new PrismaClient()` call site with a TypeScript error (constructor expects 1 required arg), not a runtime surprise.

Migrations are generated offline (this sandbox can't reach Railway's Postgres directly — only HTTPS egress works, not raw TCP): `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/<name>/migration.sql`, committed, then applied automatically on deploy via the `start` script's `prisma migrate deploy`.

### Enquiries feature

Captures every lead (website contact form, WhatsApp, Instagram, Facebook, manual) into one Postgres-backed pipeline — status tracking (New/Contacted/Won/Lost), notes, soft-delete with restore (`deletedAt`, never a hard delete), and stats (7/30-day volume, avg response time, win rate, top channel).

- `prisma/schema.prisma` — `Enquiry` model, `EnquiryChannel`/`EnquiryStatus` enums, indexed on `status`, `channel`, `deletedAt`, `createdAt`.
- `src/lib/enquiries.ts` — `validateEnquiryInput()`, shared between the public and dashboard creation paths so they can't validate differently.
- `src/app/api/public/enquiries/route.ts` — unauthenticated (no session exists on the caller's side), protected instead by a shared-secret header (`x-api-key` matched against `INTERNAL_API_SECRET`). This is what Reyse-Website's `api/contact.ts` calls server-to-server, independent of that form's Resend email — either path failing still leaves the enquiry captured by the other. Requires `INTERNAL_API_SECRET` to be set to the *same* value on both this app's Railway service and the Reyse-Website Vercel project; the route fails closed (500) if its own copy is unset, and 401s on the wrong or missing key.
- `src/app/api/enquiries/**` — session-protected CRUD (list+filter, manual/test add, PATCH status/notes, soft-delete, restore) for the dashboard itself. List is capped at 200 rows (`take: 200`, no pager UI yet).
- `src/app/api/enquiries/stats/route.ts` — always filters out `isTest` and soft-deleted rows so test/deleted data can't skew real numbers. `last7DaysCount` and 30-day `volumeByDay` bucketing are computed server-side deliberately (not with `Date.now()` in a component during render) — React's purity/`set-state-in-effect` lint rules flag date-dependent calculations done at render time.
- `src/app/(dashboard)/enquiries/page.tsx` + `src/components/enquiries/*` — the UI. Data fetching is a plain `useEffect` + `fetch` (no query library in this app yet); `react-hooks/set-state-in-effect` flags this pattern regardless of await timing since it's aimed at nudging toward Suspense/query libraries — there's a scoped `eslint-disable` on that one line with the reasoning inline.

### Env vars this feature needs

- `DATABASE_URL` — Postgres connection string (Railway).
- `NEXTAUTH_SECRET`, Google OAuth client ID/secret — existing auth requirements, unrelated to this feature.
- `INTERNAL_API_SECRET` — shared secret for `/api/public/enquiries`, must match Reyse-Website's Vercel env var of the same name.

### Social media automation

Generates and posts real single/carousel content to Reyse's own Instagram and Facebook accounts (promoting the business itself, not a per-client feature) — captions and hashtags via Claude, images either AI-generated photography (Replicate) or branded template graphics (rendered in-process), reviewed in a queue before anything goes live by default. Built 22 July 2026.

**Why this shape:** the old `reyse` repo had three separate, never-reconciled systems for this (a single-post pipeline, a carousel pipeline, a story pipeline), each with its own image source, its own storage backend, and even a different env var for the same Instagram account — explicitly judged not good enough. This is one unified pipeline instead: one content-generation path, one image-generation path (that internally chooses AI photography or a template per post), one Graph API client, one scheduler.

- `prisma/schema.prisma` — `SocialPost` (one row per platform per post; two rows sharing a `groupId` are a cross-posted Instagram+Facebook pair, generated together with identical content but published/edited independently), `SocialPostImage`, `SocialAsset` (image bytes stored in Postgres, not external blob storage — see below), `SocialSettings` (singleton row, publishing mode + cadence), `AiUsageLog` (generic, reused by any future feature with AI/paid-API costs).
- `src/lib/social/pillars.ts` — the six content pillars (Education, Tips, Promotion, Social proof, Behind the scenes, News) and the rotation order the scheduler advances through. Social proof and Behind the scenes are explicitly instructed never to fabricate a customer name, quote, or stat — Reyse's old website had fake testimonials and they were removed for exactly that reason; this is a standing constraint, not a one-off note.
- `src/lib/social/captionGenerator.ts` — Claude (`claude-opus-4-8`, adaptive thinking, `effort: "high"`, structured JSON output via `output_config.format`) grounded in the **same `ChatKnowledge` table the live chat widget uses** — one shared source of truth for pricing/feature facts across both surfaces, edited from either the Live Chat or Social admin page (same modal, same underlying content). System prompt encodes the caption structure (hook/value/CTA), the no-em-dash / no-AI-cliché brand voice rules, and 3-5 hashtags.
- `src/lib/social/contentValidation.ts` — an automated quality gate (em dash check, banned AI-slop phrases, hashtag count, caption length) run on every generation; a failure triggers one retry with the specific feedback appended before falling through to human review regardless. Not a replacement for the review queue, a first line of defence so obviously-off-brand output doesn't even reach it looking finished.
- `src/lib/social/imageGenerator.ts` + `templateRenderer.tsx` + `fonts.ts` — chooses AI photography (Replicate, `black-forest-labs/flux-1.1-pro`, a consistent camera/lighting style suffix appended to every prompt to avoid "AI slop" and keep the whole feed visually consistent) for Promotion/Social proof/Behind-the-scenes, or a branded template graphic (rendered server-side via `next/og`'s `ImageResponse`, 1080x1350, Reyse's actual brand tokens from Reyse-Website's `index.css`) for Education/Tips (carousels) and News. AI photography silently falls back to a template if Replicate is unavailable or `REPLICATE_API_TOKEN` isn't set — a missing/dead image-gen key degrades the image style, it never blocks a post. **Fonts are bundled via `@fontsource` and read from `node_modules` at render time, not fetched from Google Fonts over the network** — an earlier version fetched fonts.googleapis.com per render and it silently failed in testing (`next/og`'s `ImageResponse` throws "No fonts are loaded" if the font array ends up empty), which would have crashed image generation in production on any network hiccup. Confirmed working via a real rendered test image, not just a type-check.
- `src/lib/social/graphApi.ts` — Meta Graph API client. Instagram: single post is container-then-publish; carousel is child containers (`is_carousel_item`) → parent `CAROUSEL` container → publish, with status polling (`FINISHED`/`ERROR`/`EXPIRED`) at each step, matching the confirmed-working flow from the old repo's carousel code. Facebook: single post is `POST /{page-id}/photos` directly; multi-photo is upload-each-unpublished-then-attach-to-one-feed-post (Facebook has no native organic "carousel" post type). Also implements genuine delete (`DELETE /<id>` on both platforms, confirmed actually supported, not assumed) so "undo" on an already-published post can really remove it live, not just hide the local record.
- `src/app/api/public/social/assets/[id]/route.ts` — public, unauthenticated image-serving route (Meta's servers fetch images by plain HTTPS URL; same trust model as the live-chat SSE stream, an unguessable cuid is the access boundary). Images are stored as `Bytes` directly in Postgres rather than a separate blob store (Azure Blob, S3) — one less external dependency that could be misconfigured with nobody around to fix it, and the old repo's carousel system already used the same "Postgres as blob store" pattern successfully.
- `src/lib/social/scheduler.ts` + `src/instrumentation.ts` — a `setInterval` started from Next's `register()` boot hook, checking every 5 minutes. Confirmed as the old `reyse` backend's actual working mechanism for its Instagram autopilot (read directly from its source), not guessed — its own `CRON_JOBS.md` documented a *different*, unused mechanism, a docs/code drift this rebuild's CLAUDE.md is specifically trying not to repeat. Only makes sense on Railway's persistent Node process, not Vercel's stateless functions. Generates a new cross-posted pair on a cadence derived from `SocialSettings.postsPerWeekInstagram`; publishes anything `SCHEDULED` and due **regardless of publishing mode** — reaching `SCHEDULED` already means approval happened (human, in review-queue mode; automatic, in autonomous mode), so gating the publish step on mode too would mean an approved post in review-queue mode never actually goes out.
- `src/app/(dashboard)/instagram/page.tsx` (nav label "Social") + `src/components/social/*` — review queue UI: filter by status/pillar, a card grid with real image thumbnails (not a text table — reviewing photos and carousels needs to see them), a detail modal with editable caption/hashtags and full status-transition controls (approve & schedule / reject / publish now / undo / delete / restore), a settings panel (publishing mode toggle, cadence), and a manual "Generate now" button that bypasses the cadence timer.
- **Publishing mode is the one safety-critical control** (`SocialSettings.publishingMode`): `REVIEW_QUEUE` (default) means every generated post sits as a draft until a human approves it; `AUTONOMOUS` means the pipeline auto-approves and the scheduler publishes with no human ever looking at it. Defaults to `REVIEW_QUEUE` deliberately — this posts to a live business's real public social presence, and the first batch should be seen before anything goes out unsupervised.
- `src/lib/aiUsageLog.ts` + `/api/analytics/ai-usage` + `(dashboard)/analytics/page.tsx` — generic AI/paid-API cost logging (modelled on the old backend's `AiUsageLog`, minus the mess: no per-tenant field, one shared table for every feature) and a real usage summary replacing the Analytics placeholder. First feature to actually build this — it was flagged as a gap when the live chat widget shipped ("whichever feature needs it first should build it"). Image-generation cost isn't priced (Replicate bills per-second of compute, not per-image, so there's no honest fixed cost to log) — image calls show as counts, not a dollar figure; check the Replicate dashboard for actual spend.

**Env vars this feature needs:**
- `ANTHROPIC_API_KEY` — same key the live chat widget uses; should already be set (it originated on this Railway service during the 20 July variable migration, before being copied to Reyse-Website's Vercel project) but **not directly re-confirmed present for this feature** — verify after deploy.
- `REPLICATE_API_TOKEN` — optional. Listed in `How Reyse Works.md` as present on this Railway service but "never confirmed as used or unused" before now. If missing or invalid, AI photography silently falls back to template graphics; nothing breaks.
- `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID` — required to actually publish to Instagram. **Not confirmed to exist on this Railway service** — genuinely unknown at build time, unlike `ANTHROPIC_API_KEY`/`REPLICATE_API_TOKEN`. Without them, generation and review work fully; any publish attempt fails with a clear reason shown on the post (`FAILED` status), nothing crashes.
- `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` — same as above, for Facebook.
- `PUBLIC_BASE_URL` — optional, defaults to the working `reyse-app-production.up.railway.app` Railway URL (same `app.reyse.co.uk`-isn't-attached-yet workaround used everywhere else in this codebase). Used to build the image URLs handed to Meta's Graph API.
