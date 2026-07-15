import type { MovementCategory, TrainingCategory } from "@/lib/types/enums";
import { AB_ROUTINE_SPEC, MOVEMENT_PATTERNS } from "./movementPatterns";
import type { EngineExercise, EngineExercisePreference } from "./types";

export type RecentSlotPick = {
  movementCategory: MovementCategory;
  exerciseId: string;
  date: Date;
};

export type SelectedExercise = {
  exercise: EngineExercise;
  movementCategory: MovementCategory;
  isRequiredSlot: boolean;
  reason: string;
};

const PRIORITY_WEIGHT: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const RECENT_SESSIONS_FOR_VARIETY = 2;

function preferenceFor(
  exerciseId: string,
  preferences: EngineExercisePreference[]
): EngineExercisePreference | undefined {
  return preferences.find((p) => p.exerciseId === exerciseId);
}

function scoreCandidate(
  exercise: EngineExercise,
  preferences: EngineExercisePreference[],
  recentlyUsedExerciseIds: Set<string>
): number {
  const pref = preferenceFor(exercise.id, preferences);
  const priorityScore = PRIORITY_WEIGHT[pref?.priority ?? "MEDIUM"] ?? 2;

  let removalPenalty = 0;
  if (pref && pref.timesRemoved > 0) {
    removalPenalty =
      pref.timesRemoved >= pref.timesSelected ? 5 : pref.timesRemoved * 1.5;
  }

  const varietyBonus = recentlyUsedExerciseIds.has(exercise.id) ? 0 : 2;

  return priorityScore - removalPenalty + varietyBonus;
}

/** Picks the best exercise for a movement-category slot from the available pool. */
function pickBestCandidate(
  movementCategory: MovementCategory,
  availableExercises: EngineExercise[],
  preferences: EngineExercisePreference[],
  recentlyUsedExerciseIds: Set<string>,
  excludeExerciseIds: Set<string>
): EngineExercise | null {
  const candidates = availableExercises.filter(
    (e) => e.movementCategory === movementCategory && !excludeExerciseIds.has(e.id)
  );
  if (candidates.length === 0) return null;

  let best: EngineExercise | null = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreCandidate(candidate, preferences, recentlyUsedExerciseIds);
    const pref = preferenceFor(candidate.id, preferences);
    if (
      score > bestScore ||
      (score === bestScore &&
        best &&
        (pref?.timesSelected ?? 0) < (preferenceFor(best.id, preferences)?.timesSelected ?? 0))
    ) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Movement categories ordered by how long it's been since they were last used (oldest first). */
function orderByLeastRecentlyUsed(
  pool: MovementCategory[],
  recentPicks: RecentSlotPick[]
): MovementCategory[] {
  const lastUsedAt = new Map<MovementCategory, number>();
  for (const pick of recentPicks) {
    const existing = lastUsedAt.get(pick.movementCategory);
    if (existing === undefined || pick.date.getTime() > existing) {
      lastUsedAt.set(pick.movementCategory, pick.date.getTime());
    }
  }
  return [...pool].sort((a, b) => (lastUsedAt.get(a) ?? 0) - (lastUsedAt.get(b) ?? 0));
}

/**
 * Selects the full set of exercises for a lifting workout: one exercise per
 * required movement-pattern slot (preferring the same exercise as last time,
 * for trackable progression), plus rotating slots filled with whichever
 * movement category has gone longest without being trained, for variety.
 */
export function selectExercisesForWorkout(
  trainingCategory: Extract<TrainingCategory, "glutes_legs" | "chest_triceps" | "back_biceps">,
  availableExercises: EngineExercise[],
  preferences: EngineExercisePreference[],
  recentPicks: RecentSlotPick[]
): SelectedExercise[] {
  const spec = MOVEMENT_PATTERNS[trainingCategory];
  const remainingSlots = spec.targetExerciseCount - spec.requiredSlots.length;
  const rotatingSlots = orderByLeastRecentlyUsed(spec.rotatingPool, recentPicks).slice(
    0,
    Math.max(0, remainingSlots)
  );

  const recentlyUsedExerciseIds = new Set(
    recentPicks
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, RECENT_SESSIONS_FOR_VARIETY)
      .map((p) => p.exerciseId)
  );
  const lastPickByMovementCategory = new Map<MovementCategory, RecentSlotPick>();
  for (const pick of recentPicks) {
    const existing = lastPickByMovementCategory.get(pick.movementCategory);
    if (!existing || pick.date.getTime() > existing.date.getTime()) {
      lastPickByMovementCategory.set(pick.movementCategory, pick);
    }
  }

  const selected: SelectedExercise[] = [];
  const usedExerciseIds = new Set<string>();

  const fillSlot = (movementCategory: MovementCategory, isRequiredSlot: boolean) => {
    const lastPick = lastPickByMovementCategory.get(movementCategory);
    const lastPref = lastPick ? preferenceFor(lastPick.exerciseId, preferences) : undefined;
    const wasConsistentlyRemoved =
      !!lastPref && lastPref.timesRemoved > 0 && lastPref.timesRemoved >= lastPref.timesSelected;

    // Stable foundation: required slots repeat last session's exercise so
    // weight progression stays trackable, unless the user keeps removing it.
    if (
      isRequiredSlot &&
      lastPick &&
      !usedExerciseIds.has(lastPick.exerciseId) &&
      !wasConsistentlyRemoved &&
      availableExercises.some((e) => e.id === lastPick.exerciseId)
    ) {
      const exercise = availableExercises.find((e) => e.id === lastPick.exerciseId)!;
      selected.push({
        exercise,
        movementCategory,
        isRequiredSlot,
        reason: "Keeping this in your rotation so we can track weight progression session to session.",
      });
      usedExerciseIds.add(exercise.id);
      return;
    }

    const exercise = pickBestCandidate(
      movementCategory,
      availableExercises,
      preferences,
      recentlyUsedExerciseIds,
      usedExerciseIds
    );
    if (!exercise) return;

    selected.push({
      exercise,
      movementCategory,
      isRequiredSlot,
      reason: wasConsistentlyRemoved
        ? "Swapped in a fresh option since you've been skipping the usual pick here."
        : isRequiredSlot
          ? "Selected to cover this movement pattern for a balanced workout."
          : "Rotated in for variety while keeping your training balanced.",
    });
    usedExerciseIds.add(exercise.id);
  };

  for (const movementCategory of spec.requiredSlots) {
    fillSlot(movementCategory, true);
  }
  for (const movementCategory of rotatingSlots) {
    fillSlot(movementCategory, false);
  }

  return selected;
}

/** Selects the single ab exercise appended to every weightlifting workout. */
export function selectAbExercise(
  availableAbExercises: EngineExercise[],
  preferences: EngineExercisePreference[],
  recentPicks: RecentSlotPick[]
): SelectedExercise | null {
  const recentlyUsedExerciseIds = new Set(
    recentPicks
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, RECENT_SESSIONS_FOR_VARIETY)
      .map((p) => p.exerciseId)
  );
  const exercise = pickBestCandidate(
    AB_ROUTINE_SPEC.requiredSlots[0],
    availableAbExercises,
    preferences,
    recentlyUsedExerciseIds,
    new Set()
  );
  if (!exercise) return null;
  return {
    exercise,
    movementCategory: "core",
    isRequiredSlot: true,
    reason: "A short core finisher to round out today's session.",
  };
}
