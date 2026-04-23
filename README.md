# Kaizen 改善

A mobile-first PWA for gamified daily fitness + wellness tracking. Check in at the end of each day, earn points for the habits you hit, keep your streak alive, and climb from white belt to black.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind 4)
- **Supabase** (Postgres, Auth, Row Level Security)
- **Vercel** (hosting + auto-deploy from GitHub)

## Features

- Daily check-in with 15+ activity types (cardio, strength, martial arts, sports, wellness habits)
- Points + streak multipliers (up to 3x at 100 days)
- Belt progression: White → Yellow → Orange → Green → Blue → Purple → Brown → Black → Dan levels
- Invite-link groups with per-group leaderboards
- History (calendar) and stats (per-activity breakdowns)
- Installable as a PWA on mobile

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

### Environment variables

Copy `.env.example` to `.env.local` and fill in the values after creating your Supabase project:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Database

The schema lives in [`db/schema.sql`](db/schema.sql). After creating a Supabase project, paste it into the SQL Editor and run.

## Deployment

Pushing to `main` deploys automatically via Vercel. The production URL is set in the Vercel dashboard.
