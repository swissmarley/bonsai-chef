# Bonsai Chef — PWA

Installable web app (Italian UI) rebuilt from the original iOS app in [`../ios`](../ios).
Same features: bonsai records with six care sections, tools & supplements, photos, reminders —
plus e-mail/OTP login and sync across devices.

**Stack:** React 19 + Vite + TypeScript · `vite-plugin-pwa` (Workbox) · Netlify Functions ·
Neon Postgres (`@neondatabase/serverless`) · Netlify Blobs (photos) · Resend (e-mail) · Web Push.

```
pwa/
├── src/                 React app (pages, components, service worker src/sw.ts)
├── shared/model.ts      Types, labels and care sections shared by app and API
├── netlify/functions/   api.ts (all /api/* routes) · reminders-cron.ts (every minute)
├── netlify/lib/         auth (OTP + sessions), db, photos, push, reminders, validation
├── db/migrations/       SQL migrations (applied by scripts/migrate.mjs)
├── scripts/             setup-env, dev-db (local Postgres), migrate
└── tests/               unit tests (vitest)
```

## Run it locally

Requirements: Node 22.12+. No Docker, Neon account or e-mail provider needed.

```bash
cd pwa
npm install
npm run setup      # creates .env with AUTH_SECRET and VAPID keys
npm run dev:db     # terminal 1: local PostgreSQL on :5433 (+ migrations)
npm run dev        # terminal 2: app + functions on http://localhost:8888
```

Log in with any e-mail: without `RESEND_API_KEY` the 6-digit code is printed in the `npm run dev`
terminal. Push notifications need the production build (`npx netlify-cli serve`) or a deploy,
because the service worker is disabled in development.

Other scripts: `npm test` · `npm run typecheck` · `npm run build` · `npm run db:migrate`.

## Deploy (GitHub → Netlify)

### 1. Netlify site
1. On [app.netlify.com](https://app.netlify.com) → **Add new project → Import an existing project** → pick the GitHub repo.
2. Set **Base directory** to `pwa`. Build command (`npm run build`) and publish directory (`dist`) come from `pwa/netlify.toml`.

### 2. Database (Neon)
1. Create a project at [console.neon.tech](https://console.neon.tech) (free tier is plenty) in the same region as your
   Netlify functions: **AWS US East 2 (Ohio)**, Netlify's default. A distant database adds a round trip to every query.
2. **Connect** → copy the **pooled** connection string → Netlify variable `DATABASE_URL`.
3. Optional: the direct (unpooled) string → `DATABASE_URL_UNPOOLED`, used only for migrations.

If you add Neon through Netlify's Neon extension instead, it sets `NETLIFY_DATABASE_URL`, which the app reads as well.
Migrations run automatically at the end of every build (`scripts/migrate.mjs`), so the schema is created on the first deploy.

### 3. E-mail (Resend)
1. Create an account at [resend.com](https://resend.com) and an API key → `RESEND_API_KEY`.
2. Verify your domain and set `EMAIL_FROM`, e.g. `Bonsai Chef <accesso@tuodominio.it>`.
   Until a domain is verified, `onboarding@resend.dev` can only send to your own Resend account address.

### 4. Environment variables
Netlify → **Project configuration → Environment variables**:

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | Neon pooled connection string |
| `AUTH_SECRET` | yes | from your `.env` (`npm run setup`), ≥ 32 random characters |
| `RESEND_API_KEY` | yes | Resend API key |
| `EMAIL_FROM` | yes | verified sender |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for push | from your `.env` — keep them stable, changing them invalidates devices' subscriptions |
| `VAPID_SUBJECT` | for push | `mailto:you@example.com` |
| `ALLOWED_EMAILS` | optional | comma-separated allow-list; empty = anyone can sign up |

Then trigger a deploy. Every push to `main` deploys to production; pull requests get deploy previews.
Commits that only touch `ios/` are skipped.

## Notes

- **iPhone / iPad:** open the site in Safari → Share → *Aggiungi alla schermata Home*. Push notifications on iOS
  work only for the installed app (iOS 16.4+). Without push, reminders arrive by e-mail.
- **Reminders** are checked every minute by the `reminders-cron` scheduled function (published deploys only). The time of
  the next reminder is kept in Netlify Blobs, so the database is only queried when one is due (plus an hourly safety
  check) and Neon can scale to zero in between. Failed deliveries are retried up to 5 times.
- **Offline:** the app shell and the last loaded data work offline; changes need a connection.
- **Photos** are resized in the browser (max 1600 px JPEG, metadata stripped) and stored in Netlify Blobs; only
  their owner can load them.
- **Security:** OTPs are HMAC-hashed, expire after 10 minutes and allow 5 attempts; sessions are HttpOnly cookies
  whose SHA-256 is stored server-side; writes from other origins are rejected; production pages ship a strict CSP.
- Deploy previews share the production database and photo storage: treat them like production, and keep
  migrations backwards compatible.
