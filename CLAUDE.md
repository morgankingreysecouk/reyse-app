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
