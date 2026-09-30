# Bonsai Chef — da app iOS a PWA

Plan for rebuilding the SwiftUI iOS app (`../ios`) as an installable Progressive Web App
hosted on Netlify, with data in Neon Postgres and passwordless e‑mail/OTP login.
The UI stays **entirely in Italian** and keeps every feature of the original.

## 1. What the iOS app does today

| Area | iOS implementation | Notes |
|---|---|---|
| Tabs | `TabView`: History/Tutti, Outdoor/Esterno, Indoor/Interno, Tools/Strumenti & Altro | "Tutti" lists bonsai **and** tools; "Strumenti" groups tools by type |
| Bonsai record | `BonsaiRecord` (26 fields) | name, category (Esterno/Interno), Substrato, Vaso + 6 care sections |
| Care sections | Rinvaso, Potatura, Taglio Germogli, Applicazione Filo, Defogliazione, Concimazione | each: best period (start→end month) + notes; Rinvaso & Filo also a "last done" date; Concimazione also fertilizer type |
| Tool record | `ToolsSupplementsRecord` | Nome, Tipologia (Substrati / Bonsai Tools / Accessori), Genere, Venditore, Prezzo, Links, Dettagli |
| Photos | `PHPicker` → JPEG in Documents dir | multiple per record, grid + swipeable full-screen viewer |
| Add / edit / delete | sheets + list edit mode | list delete removes by the wrong index (bug) |
| Reminders | `UNUserNotificationCenter` local notification | message + date/time per bonsai, title "Promemoria Bonsai Chef" |
| Storage | `UserDefaults` JSON | single device, no account, no sync |

## 2. Target architecture

```
Browser / installed PWA (React + Vite, Service Worker)
   │  fetch /api/*  (HttpOnly session cookie)
   ▼
Netlify Function  api      ──►  Neon Postgres  (users, sessions, login codes, bonsai, tools, photos, reminders, push subs)
   │                        ──►  Netlify Blobs  (photo files)
   │                        ──►  Resend        (OTP + fallback reminder e‑mails)
Netlify Scheduled Function  reminders-cron (every minute) ──► Web Push (VAPID) / e‑mail
```

| Concern | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite, React Router, TanStack Query | mature, fast, great PWA tooling |
| PWA | `vite-plugin-pwa` (injectManifest) + Workbox | precached app shell, offline reading, custom push handlers |
| API | One Netlify Function (v2) with a small router at `/api/*` | one cold start, shared code, simple deploys |
| Database | Neon via `@neondatabase/serverless` (HTTP) | Neon's recommended driver for serverless; `pg` only for local dev |
| Photos | Netlify Blobs, resized client-side (max 1600px JPEG) | no extra service, stays under the 6 MB function limit |
| Auth | E‑mail → 6‑digit OTP → opaque session cookie | no passwords; codes HMAC-hashed, 10 min TTL, 5 attempts, rate limited |
| E‑mail | Resend HTTP API (no SDK) | simplest provider on Netlify; dev mode prints codes to the console |
| Reminders | Stored in Postgres, delivered by a scheduled function via Web Push; e‑mail fallback | replaces iOS local notifications; works on iOS 16.4+ when installed to Home Screen |
| Styling | Hand-written CSS, iOS "inset grouped" look, light/dark | feels like the original app |

## 3. Data model (Neon)

- `users(id, email unique, created_at, last_login_at)`
- `login_codes(id, email, code_hash, ip, attempts, created_at, expires_at)`
- `sessions(token_hash pk, user_id, expires_at, user_agent)` — sliding 90‑day expiry
- `bonsai(id, user_id, name, category esterno|interno, substrate, pot, care jsonb, timestamps)`
  - `care` = `{ repotting, pruning, shootCutting, wiring, defoliation, fertilizing }`, each
    `{ startMonth, endMonth, notes, lastDate?, fertilizerType? }`
- `tools(id, user_id, name, type substrato|attrezzo|accessorio, genre, seller, price, links, details, timestamps)`
- `photos(id, user_id, bonsai_id?, tool_id?, position, content_type, byte_size, width, height)` — blob key `userId/photoId`
- `reminders(id, user_id, bonsai_id, message, remind_at, sent_at)`
- `push_subscriptions(id, user_id, endpoint unique, p256dh, auth)`

Every query is scoped by `user_id`, so each account only sees its own data.
Migrations are plain SQL files in `db/migrations`, applied by `scripts/migrate.mjs` (also at build time).

## 4. API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/request-code` | send OTP to e‑mail |
| POST | `/api/auth/verify-code` | verify OTP → set session cookie |
| GET | `/api/auth/me` | current user |
| POST | `/api/auth/logout` | end session |
| GET/POST | `/api/bonsai` | list / create |
| PUT/DELETE | `/api/bonsai/:id` | update / delete |
| GET/POST | `/api/tools` | list / create |
| PUT/DELETE | `/api/tools/:id` | update / delete |
| POST | `/api/photos` | upload one resized image |
| GET | `/api/photos/:id` | serve image (owner only, immutable cache) |
| GET/POST | `/api/reminders` | list pending / create |
| DELETE | `/api/reminders/:id` | cancel |
| GET | `/api/push/public-key` | VAPID key |
| POST | `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/test` | manage device notifications |

## 5. Screens (all Italian)

- **Accesso**: splash logo, e‑mail → code (auto-submit, resend with countdown).
- **Tab bar**: Tutti · Esterno · Interno · Strumenti (same four tabs as iOS).
- **Lists**: iOS-style rows with thumbnail; "Modifica" mode with delete; "+" adds a bonsai or tool
  (context-aware, like the two toolbar buttons of the original).
- **Bonsai detail**: cover photo, Substrato/Vaso, six care cards with a 12‑month "periodo migliore" bar,
  pending reminders, photo grid → full-screen swipe viewer. Bell = new reminder, pencil = edit.
- **Bonsai form** (Aggiungi / Modifica): same fields and sections as iOS; month pickers; photo add/remove.
- **Tool detail / form**: Descrizione, Link (clickable), Dettagli, Foto.
- **Account sheet**: e‑mail, notification setup + test, logout.

## 6. Security

- OTP: `crypto.randomInt`, HMAC-SHA256 with `AUTH_SECRET`, 10‑min expiry, 5 attempts, 1 code/60 s and
  5 codes/h per e‑mail, 20 codes/h per IP; optional `ALLOWED_EMAILS` allow-list.
- Session: 256‑bit random token, only its SHA‑256 is stored; cookie `HttpOnly; Secure; SameSite=Lax`.
- Mutations reject foreign `Origin` headers; all input validated with zod; photos served only to their owner.

## 7. Implementation steps

1. Scaffold project (Vite, TS, Netlify config, icons generated from the original logo & launch image).
2. Database: migration SQL, migration runner, local embedded Postgres for development.
3. Backend libs: db, http/router, auth, e‑mail, photos, push, validation.
4. API routes + scheduled reminders function.
5. Frontend: API client, auth gate & login, shell/tab bar, lists, detail pages, forms, photos, reminders, account.
6. Service worker: precache, offline caching, push + notification click, update prompt.
7. Verify: typecheck, unit tests, end-to-end run with `netlify dev` in a browser (mobile viewport).
8. Docs: README with local dev + Netlify/Neon/Resend deployment steps.

## 8. Differences from the iOS app (intentional)

- Login & cloud sync (required for a web app; data follows you across devices).
- Leftover English labels translated: "History" → "Tutti", "Bonsai Tools" → "Attrezzi", "Fotos" → "Foto", "Links" → "Link".
- Month range and "last done" dates can be left empty instead of defaulting to January/today.
- Pending reminders are listed on the bonsai page and can be cancelled.
- Fixed the list-delete bug; deleting asks for confirmation.
