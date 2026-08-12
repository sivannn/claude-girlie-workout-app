"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * "I already lift this much" — entered once so a brand-new exercise doesn't
 * spend a session calibrating up from a bodyweight guess.
 *
 * Stored on ExercisePreference and consulted only when the exercise has no
 * logged history; the moment there's a real session, that wins.
 */
export async function saveStartingWeights(
  entries: Array<{ exerciseId: string; weightLb: number | null }>
): Promise<void> {
  const user = await getCurrentUser();

  const exerciseIds = entries.map((e) => e.exerciseId);
  const owned = await prisma.exercise.findMany({
    where: { id: { in: exerciseIds }, userId: user.id },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((e) => e.id));

  for (const entry of entries) {
    if (!ownedIds.has(entry.exerciseId)) continue;
    const weight =
      entry.weightLb != null && Number.isFinite(entry.weightLb) && entry.weightLb > 0
        ? Math.min(1500, entry.weightLb)
        : null;
    await prisma.exercisePreference.upsert({
      where: { userId_exerciseId: { userId: user.id, exerciseId: entry.exerciseId } },
      update: { knownStartingWeightLb: weight },
      create: { userId: user.id, exerciseId: entry.exerciseId, knownStartingWeightLb: weight },
    });
  }
  revalidatePath("/", "layout");
}
