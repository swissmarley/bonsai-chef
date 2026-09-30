# Bonsai Chef v2 — Gruppi, Storico interventi, Info

Features requested by the first testers, planned on 2026-09-30. They go beyond the iOS app (`../ios`),
which does not get them. Everything ships in one release, from branch `feature/gruppi-storico`
through a pull request that the owner merges on release day.

## 1. Tester feedback

1. **Gruppi** — "In Pini metto tutti i pini, in Acero tutti gli aceri": user-named collections of bonsai.
2. **Storico** — a history instead of a single "last date":
   - Rinvaso: every repotting with its date and the soil mix used, the interval between repottings,
     to see how the mix evolves.
   - Concimazione: every feeding, solid and liquid, with the product (e.g. Hanagokoro in spring,
     then Seiki every three weeks).
   - Goal: understand over time how the tree responds to what you do.

Added by the owner: an Info page (app, developer, contact form) and the "Created by Nakya" credit on the
login screen as real text instead of tiny text baked into the artwork.

## 2. Data safety (non-negotiable)

Testers already saved their plants in the production database. No change may delete or alter existing data.

| Risk found in the code | Rule |
|---|---|
| `npm run build` applies migrations in **every** Netlify context, and deploy previews share the production database (per-context variables are a Netlify Pro feature, not available on the free plan) | Guarded in code, in the first commit of the branch: on Netlify, build-time migrations run only when `CONTEXT=production`. |
| Deploy previews run the functions against the production database and photo storage (Netlify Blobs) | Guarded in code: `/api/*` and the cron answer 503 before touching the database or Blobs unless `context.deploy.context` is `production` (or `dev` for local `netlify dev`). The PR preview therefore shows the app but cannot read or write any data. |
| Schema changes could rewrite rows | Migrations are additive only: `CREATE TABLE`, `ADD COLUMN` (nullable or with a default), and widening one `CHECK`. No `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, `RENAME` or type change; no backfill. A test enforces it. |
| Old app versions stay cached by the service worker, and `PUT /api/bonsai/:id` rewrites the whole row | New bonsai fields (`groupId`, `schedule`) are "absent in the request = keep the stored value". The diary has its own endpoints, which old versions never call. |
| The cron deletes photos that have neither `bonsai_id` nor `tool_id` after one day | Diary photos keep `bonsai_id` **and** get `event_id`, so every code version (including a rollback) treats them as attached. The bonsai form never detaches diary photos. |
| Old versions crash on an unknown Strumenti category | `concime` tools are returned only to clients that ask for them (`GET /api/tools?types=all`). |
| `care` jsonb holds the existing care data | Left untouched. Existing "Ultimo Rinvaso" / "Ultima Applicazione" dates are shown in the timeline as read-only entries ("dalla scheda"); nothing is copied or converted. |

Rollback (Netlify "Publish deploy" of the previous version) stays safe: the old code ignores the new tables and columns.

## 3. Database — `db/migrations/003_gruppi_storico.sql` (additive)

- `bonsai_groups (id, user_id → users CASCADE, name, position, created_at, updated_at)`
- `bonsai.group_id uuid NULL → bonsai_groups ON DELETE SET NULL` — deleting a group only ungroups its trees.
- `bonsai.schedule jsonb NOT NULL DEFAULT '{}'` — per care type `{ every, unit: giorni|settimane|mesi|anni, autoReminder }`.
- `care_events (id, user_id, bonsai_id → bonsai CASCADE, kind, date, notes, details jsonb, batch_id, created_at, updated_at)`
  - `kind`: the six care keys + `observation` ("Osservazione").
  - `details`: Rinvaso `{ mix, pot }`, Concimazione `{ product, form: solido|liquido, dose }`, plus the names of linked tools
    (so the history stays readable if a Strumenti item is deleted).
  - `batch_id`: the same id on every entry created by "Applica a tutto il gruppo".
- `care_event_tools (event_id → care_events CASCADE, tool_id → tools CASCADE, position)` — a mix can use several substrati.
- `photos.event_id uuid NULL → care_events ON DELETE SET NULL` — deleting an entry keeps its photos in the tree's gallery.
- `reminders.care_kind text NULL` — marks reminders created automatically from a frequency.
- `tools.type` CHECK widened to also allow `concime` (existing rows are untouched).
- `feedback_messages (id, user_id, message, created_at, sent_at)` — record of contact-form messages, also used for rate limiting.
- `seen_announcements (user_id → users CASCADE, key, seen_at, PRIMARY KEY (user_id, key))` — the "Novità" message
  already dismissed by an account (insert only; existing `users` rows are not modified).

## 4. API

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/groups` | list / create |
| PUT/DELETE | `/api/groups/:id` | rename, reorder / delete (trees become "Senza gruppo") |
| GET | `/api/bonsai` | now also returns `groupId`, `schedule`; `photos` = gallery photos only |
| PUT | `/api/bonsai/:id` | `groupId` / `schedule` optional: absent = keep |
| GET | `/api/bonsai/:id/events` | diary of one tree, newest first, with photos and linked tools |
| POST | `/api/events` | create for one tree, or for several (`bonsaiIds`, same `batch_id`); optionally the next auto-reminder |
| PUT/DELETE | `/api/events/:id` | edit / delete one entry |
| GET | `/api/tools?types=all` | includes `concime` (new clients only) |
| POST | `/api/feedback` | contact form → e-mail to `FEEDBACK_EMAIL` (reply-to = the tester), max 5 per hour per user |
| GET | `/api/announcements` | the announcements this account already dismissed |
| POST | `/api/announcements/:key/seen` | marks the "Novità" message as dismissed for this account |

All queries stay scoped by `user_id`; input validated with zod; Italian error messages.

## 5. Screens (Italian)

- **Liste (Tutti / Esterno / Interno)** — bonsai in one section per group (in the group order) + "Senza gruppo";
  empty groups hidden. "Gestisci gruppi" sheet: create, rename, move up/down, delete.
- **Form bonsai** — group picker (with "Nuovo gruppo…"); per care section a "Frequenza" (ogni N giorni/settimane/mesi/anni)
  and "Promemoria automatico".
- **Dettaglio bonsai**
  - Care cards: last date, count, average interval, "Prossimo previsto" (from the frequency); "Ripeti" on Concimazione.
  - New **Storico** section: timeline with filter chips per type, "Registra intervento".
  - **Foto**: gallery + diary photos, sorted by date, with the date on each photo.
- **Registra / modifica intervento** — date (default today), type, notes; Rinvaso: miscela, vaso, substrati from Strumenti;
  Concimazione: prodotto, solido/liquido, dose, concimi from Strumenti; free text with suggestions from past entries;
  photos; "Applica a tutto il gruppo «Pini»" (no photos in that mode — add them per tree afterwards);
  "Crea promemoria per il prossimo" when a frequency is set.
- **Strumenti** — new "Concimi" section.
- **Info** (`/info`, from the Account sheet and from the login credit) — the app, version, developer, contact form.
- **Login** — artwork cropped without the credit; "Creato da Nakya" as real text under the login card.
- **Novità** — after the update, a dialog on the first app open (also for users who stay signed in and never see the
  login again): what's new (Gruppi, Storico, Frequenza e promemoria, Foto negli interventi, Concimi, Info e contatti)
  and thanks to the testers for their suggestions. Shown **once per account**: closing it in any way (button, ✕,
  tapping outside) saves it as seen on the server, so it never appears again, on any device (also remembered on the
  device in case the save fails). Accounts with no bonsai or tools yet are new users: they skip it.
- Offline: the new GET endpoints join the `bc-data` cache.

## 6. Steps (one PR, several commits)

1. Safety net (first commit, before any push): production-only build migrations; runtime guard so non-production
   deploys never touch the database or Blobs; SQL guard test; migration rehearsal test (old-format data must be
   byte-identical after migrating); old-client payload tests.
2. Migration 003 + shared model types.
3. Backend: groups, bonsai changes, events, photos/purge changes, tools filter, feedback.
4. Frontend: groups in lists/form, diary, frequency & reminders, gallery by date, Concimi, Info page, login credit,
   "Novità" dialog.
5. Verify: typecheck, tests, local run (`dev:db` + `netlify dev`), full rehearsal against a Neon branch copy of
   production (created by the owner; its URL only in a local, git-ignored env file), browser test at phone size.
6. Push the branch and open the PR — **not merged**.

## 7. Release checklist (owner)

Before the PR is opened: nothing — the protection against deploy previews is in the branch's code.
Optional extra barrier: Netlify → Branches and deploy contexts → Deploy Previews → "None", if the plan allows it.

Before release day:
- [ ] Netlify → Environment variables: add `FEEDBACK_EMAIL` (where contact-form messages arrive).

Rehearsal on a copy of production (before merging):
- [ ] Neon console → Branches → create a branch from production (e.g. `rehearsal-v2`) → copy its connection string.
- [ ] `REHEARSAL_DATABASE_URL=<that string> npm run db:rehearse` — must end with "Rehearsal passed".
  Then delete that branch (it is only a copy).

On release day:
- [ ] Neon: create a branch `backup-pre-v2` from production (instant copy, restorable).
- [ ] Merge the PR → the production build applies migration 003.
- [ ] Check in the app that every tree, photo and reminder is still there.
- [ ] If anything is wrong: Netlify → Deploys → publish the previous deploy (safe with the new schema).
