# TapTab

One tap at every table: menu, Wi‑Fi, reviews, rewards and "call your server", from an NFC tag.

Stack: Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth, Realtime) · Vercel.

## What's built (Nov 3)

- **Database** (`supabase/migrations/0001_init.sql`): organizations, locations, hub settings, tables,
  staff contacts, tags and tag batches, hardware orders, menus, events, server requests, guest notes,
  loyalty cards, demo leads. Row level security tested: a restaurant can only see its own data,
  staff can't edit settings, nobody can make themselves an admin.
- **Demo data** (`supabase/seed.sql`): Saffron Street Kitchen, 16 tables, tags `DEMO0001`–`DEMO0016`, full menu.
- **Tag links**: `/t/CODE` finds the tag, records the tap and opens that table's hub.
- **Guest hub**: menu with diet filters, English/Spanish, Wi‑Fi, star rating with Google link for
  every guest plus a private note to the manager, Call server (help / bring the check / refill),
  rewards card by phone number with one stamp per visit.
- **Guest API** (`/api/guest`): validated input, no duplicate server alerts, note flood limit.

## What's new (Day 2)

- Logins: /login, /signup, /forgot-password, /reset-password, email links via /auth/confirm.
- After sign-in, /app sends TapTab admins to /admin and restaurant staff to /dashboard.
- Owners invite their team at /dashboard/team (owner, manager or staff).
- Admin: /admin lists restaurants and creates new ones with tables and tags; /admin/locations/ID shows
  each table's NFC link and a printable QR sheet.
- QR scans open /t/CODE?s=qr and are counted separately from NFC taps (migration 0002).

## Setup (about 15 minutes)

1. Create a Supabase project at supabase.com (region: US Central or East).
2. In Supabase: **SQL Editor** → run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`, then `supabase/migrations/0002_tap_source.sql`.
3. Copy `.env.example` to `.env.local` and fill in the values from **Project Settings → API**.
4. `npm install` then `npm run dev`
5. Open http://localhost:3000/t/DEMO0012 on your computer, or your computer's local address on your phone.

To make yourself the TapTab admin after signing up (logins arrive Day 2):
`update profiles set is_platform_admin = true where id = (select id from auth.users where email = 'you@example.com');`

## Deploy

Push to GitHub, import the repo in Vercel, add the same 4 environment variables, deploy.

## Next up

Day 2: login screens and roles · QR code backup per tag · first test on a real Supabase project.

## Deploying

Pushing to `main` on GitHub deploys to production on Vercel automatically
(https://taptab.brandrise.us). Database changes live in `supabase/migrations`
and are applied separately in the Supabase SQL editor.
