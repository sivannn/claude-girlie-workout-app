import "server-only";
import { prisma } from "@/lib/prisma";
import type { CoachInsightCategory } from "@/lib/types/enums";

/**
 * Caches Alex's generated copy in the CoachInsight table.
 *
 * Home, Calendar, and Progress each called the API on *every* render, so
 * simply opening the app three times paid for three round trips of latency
 * and tokens to regenerate sentences about facts that hadn't changed. The
 * schema anticipated this table from the start; nothing had used it.
 *
 * Cache key is the category plus a fingerprint of the facts being phrased, so
 * copy is reused until the underlying numbers actually change, and a stale
 * sentence can never outlive the fact it describes.
 */

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Stable fingerprint of the facts a piece of copy was generated from. */
function fingerprint(facts: unknown): string {
  return JSON.stringify(facts);
}

export async function cachedInsight(params: {
  userId: string;
  category: CoachInsightCategory;
  /** Everything the copy is derived from — changing any of it busts the cache. */
  facts: unknown;
  /** Called only on a miss. */
  generate: () => Promise<string>;
  ttlMs?: number;
  relatedWorkoutId?: string | null;
  relatedGoalId?: string | null;
}): Promise<string> {
  const factsJson = fingerprint(params.facts);
  const ttl = params.ttlMs ?? DEFAULT_TTL_MS;
  const freshAfter = new Date(Date.now() - ttl);

  const hit = await prisma.coachInsight.findFirst({
    where: {
      userId: params.userId,
      category: params.category,
      factsJson,
      generatedAt: { gte: freshAfter },
    },
    orderBy: { generatedAt: "desc" },
  });
  if (hit) return hit.text;

  const text = await params.generate();

  // Replace rather than accumulate: one row per user+category, refreshed.
  await prisma.coachInsight.deleteMany({
    where: { userId: params.userId, category: params.category },
  });
  await prisma.coachInsight.create({
    data: {
      userId: params.userId,
      category: params.category,
      text,
      factsJson,
      relatedWorkoutId: params.relatedWorkoutId ?? null,
      relatedGoalId: params.relatedGoalId ?? null,
    },
  });
  return text;
}
