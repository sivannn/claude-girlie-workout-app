# Steam — Claude Girlie Workout App

A premium AI fitness coach: an "Alex" persona that recommends workouts using deterministic,
evidence-based progression logic, then phrases the coaching copy in natural language.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Prisma + SQLite (`better-sqlite3` driver adapter)
- Anthropic SDK — used **only** for natural-language coaching copy; all workout
  recommendations, progression math, and goal logic are deterministic (`src/lib/engine/`)

## Getting started

```bash
npm install
cp .env.example .env  # then set BETTER_AUTH_SECRET (openssl rand -base64 33)
npm run db:migrate    # apply the Prisma schema to prisma/dev.db
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and **sign up** — accounts are
real now (Better Auth, email + password). Signup automatically provisions your
workout-type and exercise library and drops you into the intro questionnaire.

`npm run db:seed` still exists as a dev convenience: it creates a passwordless
legacy account with the library pre-seeded. To turn seeded data into a real
login (or move pre-auth data onto an account), see
`scripts/migrate-legacy-user.ts`. Forgot a password? There's no email reset at
friend scale — run `npx tsx scripts/reset-password.ts <email> <new-password>`.

To enable Alex's AI-generated briefs/recaps/insights, add your key to `.env`:

```
ANTHROPIC_API_KEY=sk-...
```

Without a key, the app falls back to templated coaching copy so it never breaks.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Re-seed workout types / exercise library |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run unit tests (rules engine) |

## Architecture

- `src/lib/engine/` — deterministic rules engine (movement patterns, exercise selection,
  progression, recommendations, goal milestones/forecasts). Pure TypeScript, no AI dependency.
- `src/lib/ai/` — Claude API wrapper. Takes engine output and phrases it in Alex's voice;
  never computes numbers itself.
- `src/lib/design/categories.ts` — the two-level workout category color system, shared by
  every page.
- `src/lib/auth-server.ts` / `src/lib/auth.ts` — Better Auth instance (email +
  password, 90-day rolling cookie sessions) and the `getCurrentUser()` session
  helper every server component/action goes through.
- `prisma/schema.prisma` — data model. Every row is scoped by `userId`; accounts
  are real multi-user with per-account library provisioning at signup.
