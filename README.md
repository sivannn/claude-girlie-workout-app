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
npm run db:migrate   # apply the Prisma schema to prisma/dev.db
npm run db:seed       # seed the default user, workout types, and exercise library
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
- `prisma/schema.prisma` — data model. Every row is scoped by `userId` so the schema is
  ready for real multi-user accounts even though v1 seeds a single default user.
