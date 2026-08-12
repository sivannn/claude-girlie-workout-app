<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Environment setup — please action this

Some features need secrets that are deliberately **not** in the repo. If you're
an agent working in this repo, set these up (or tell Sivan which ones you need
her to provide), then delete nothing from this section — it's the checklist.

Secrets belong in `.env` locally (already gitignored) and in the hosting
provider's environment settings for the deployed app. **Never commit a real
secret to the repo**, and never paste one into a file that isn't `.env`.

## Required for the app to run at all

| Variable | How to get it |
| --- | --- |
| `DATABASE_URL` | `file:./prisma/dev.db` for local development. |
| `BETTER_AUTH_SECRET` | Generate one: `openssl rand -base64 33`. Any long random string works; it signs session cookies. A different value locally and in production is fine and expected. |

Without `BETTER_AUTH_SECRET`, login and signup fail.

## Required in the deployed app

| Variable | Notes |
| --- | --- |
| `BETTER_AUTH_SECRET` | Generate a **separate** one for production. |
| `BETTER_AUTH_URL` | The deployed origin, e.g. `https://<app>.vercel.app`. Auth callbacks and cookies use it. |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | From `turso db show <db>` and `turso db tokens create <db>`. When set, the app uses Turso instead of the local SQLite file. |

**If the deployed site fails at login, a missing `BETTER_AUTH_SECRET` or
un-applied migrations are the first things to check.** The auth tables
(`Session`, `Account`, `Verification`, `rateLimit`) and the periodization
tables must exist in the Turso database — `npm run db:migrate` only touches
the local SQLite file, so production migrations are a separate, deliberate step.

## Optional — enables Alex's AI features

| Variable | What it unlocks |
| --- | --- |
| `ANTHROPIC_API_KEY` | Coaching copy (briefs, recaps, insights) and **meal photo calorie estimation** on the Calories tab. Get one at https://console.anthropic.com/ |

The app is built to degrade gracefully without it: coaching copy falls back to
templated text, and meal photos fall back to manual calorie entry. Nothing
breaks — those features just get quieter. **Photo analysis has not been tested
against the live API** because no key was available while it was written; the
first thing to do once a key is set is upload a real meal photo and sanity-check
the estimate.

## Please do NOT do these without asking Sivan first

- Running any migration or script against the **production/Turso** database.
  `scripts/migrate-legacy-user.ts` refuses to run when `TURSO_DATABASE_URL` is
  set, on purpose. That guard should only be lifted for an explicitly approved
  production migration.
- Deploying, or changing deployment settings.
- Rotating an existing `BETTER_AUTH_SECRET` on a live app — it signs out every
  logged-in user.

## Optional, not blocking

- **App icons are already done.** `src/app/icon.png`, `apple-icon.png`,
  `favicon.ico` and `public/steam-logo.png` are Sivan's real Steam logo, added
  in "Rename app from Bloom to Steam and add new logo". Nothing to replace. If
  they are ever swapped, the sizes declared in `src/app/manifest.ts` must match
  the new files.
- **Calendar day-cell styling** was built from a written description rather
  than the screenshots it referenced. It's worth an eyeball against what was
  intended, but it isn't blocking anything.
