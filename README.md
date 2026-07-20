# Reyse Admin

Foundation rebuild of the Reyse admin console — replaces the old `reyse`
repo's super-admin side. This is the shell only: auth, layout, design
system, and placeholder routes for each planned section. Real workflows
(enquiries, live chat, Instagram automation, lead gen) get built out one
at a time from here.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- NextAuth.js (Google OAuth), locked to a single allowlisted email — no
  database, no roles table, nothing to misconfigure
- Hosted on Railway (kept from the old setup — this app will eventually
  run always-on background jobs, which Vercel's serverless model doesn't
  support)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Google OAuth credentials
npm run dev
```

Google OAuth setup: Google Cloud Console → APIs & Services → Credentials
→ OAuth client ID (Web application). Authorised redirect URI:
`{NEXTAUTH_URL}/api/auth/callback/google`.

## Structure

```
src/
├── app/
│   ├── login/                Public sign-in page
│   ├── (dashboard)/          Everything behind auth
│   │   ├── layout.tsx        Sidebar + top bar shell
│   │   ├── page.tsx          Overview
│   │   ├── enquiries/
│   │   ├── live-chat/
│   │   ├── instagram/
│   │   ├── leads/
│   │   ├── analytics/
│   │   └── settings/
│   └── api/auth/[...nextauth]/
├── components/
│   ├── ui/                   Button, Card, Badge — design-system primitives
│   └── shell/                Sidebar, Topbar, Logo, PlaceholderPage
├── lib/
│   ├── auth.ts                NextAuth config + email allowlist
│   ├── nav.ts                 Sidebar nav items
│   └── cn.ts                  Class-name helper
└── proxy.ts                     Route protection (Next.js 16's successor to middleware.ts)
```

## Status

Foundation only — see the Overview page in-app for what's done vs. not
started.
