import type { EngineExercise, EngineExerciseSession } from "./types";

export type ProgressionDecision = {
  recommendedWeight: number | null;
  recommendedRepsLow: number;
  recommendedRepsHigh: number;
  warmupWeight: number | null;
  warmupReps: number | null;
  reason: string;
  isDeload: boolean;
  isFirstTime: boolean;
};

const DEFAULT_REP_LOW = 8;
const DEFAULT_REP_HIGH = 12;
const DEFAULT_INCREMENT_LB = 5;
const DELOAD_STALL_THRESHOLD = 3; // consecutive non-progressing sessions
const RETURN_FROM_BREAK_DAYS = 21;

function roundToIncrement(value: number, increment: number): number {
  const step = increment >= 5 ? 5 : increment;
  return Math.round(value / step) * step;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

/** A session's working sets, excluding any set missing weight or reps (incomplete data). */
function workingSetsOf(session: EngineExerciseSession) {
  return session.sets.filter((s) => s.actualWeight != null && s.actualReps != null) as Array<{
    actualWeight: number;
    actualReps: number;
    recommendedWeight: number | null;
  }>;
}

function representativeWeight(sets: Array<{ actualWeight: number }>): number {
  // Working sets are expected to share one target weight (straight sets);
  // take the max as the representative in case of manual edits mid-session.
  return Math.max(...sets.map((s) => s.actualWeight));
}

function reachedTopOfRange(sets: Array<{ actualReps: number }>, repHigh: number): boolean {
  return sets.every((s) => s.actualReps >= repHigh);
}

function belowMinOfRange(sets: Array<{ actualReps: number }>, repLow: number): boolean {
  return sets.some((s) => s.actualReps < repLow);
}

function wasVoluntaryReduction(
  sets: Array<{ actualWeight: number; recommendedWeight: number | null }>
): boolean {
  return sets.some((s) => s.recommendedWeight != null && s.actualWeight < s.recommendedWeight);
}

/**
 * Counts consecutive most-recent sessions (starting at index 0) that were a
 * genuine attempt (not a voluntary reduction) but failed to reach the top of
 * the rep range. Stops at the first progression, voluntary reduction, or gap.
 */
function countConsecutiveStalls(sessions: EngineExerciseSession[], repHigh: number): number {
  let streak = 0;
  for (const session of sessions) {
    const sets = workingSetsOf(session);
    if (sets.length === 0) break;
    if (wasVoluntaryReduction(sets)) break; // neutral event — stop counting rather than break the streak
    if (reachedTopOfRange(sets, repHigh)) break; // progressed — streak broken
    streak += 1;
  }
  return streak;
}

/**
 * Double progression model from the Workout Playbook: increase weight only
 * once all working sets reach the top of the rep range; otherwise hold
 * weight and aim for more reps. Never progresses on missed reps, voluntary
 * weight cuts, or a long layoff; recommends a deload after 3+ stalled
 * sessions in a row.
 */
export function decideProgression(
  exercise: EngineExercise,
  /** Most-recent-first session history for this exact exercise. */
  recentSessions: EngineExerciseSession[],
  asOfDate: Date,
  startingWeightHint?: number | null
): ProgressionDecision {
  const repLow = exercise.repRangeLow ?? DEFAULT_REP_LOW;
  const repHigh = exercise.repRangeHigh ?? DEFAULT_REP_HIGH;
  const increment = exercise.defaultIncrementLb ?? DEFAULT_INCREMENT_LB;

  if (recentSessions.length === 0) {
    const weight = startingWeightHint ?? null;
    return {
      recommendedWeight: weight,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: weight != null ? roundToIncrement(weight * 0.5, 5) : null,
      warmupReps: weight != null ? 10 : null,
      reason:
        "First time programming this exercise — starting at a conservative weight to establish your baseline.",
      isDeload: false,
      isFirstTime: true,
    };
  }

  const [last] = recentSessions;
  const lastWorkingSets = workingSetsOf(last);

  if (lastWorkingSets.length === 0) {
    return {
      recommendedWeight: startingWeightHint ?? null,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: null,
      warmupReps: null,
      reason: "No usable data from your last session — holding steady while we rebuild history.",
      isDeload: false,
      isFirstTime: false,
    };
  }

  const lastWeight = representativeWeight(lastWorkingSets);
  const daysSinceLast = daysBetween(asOfDate, last.date);

  if (daysSinceLast > RETURN_FROM_BREAK_DAYS) {
    const resetWeight = roundToIncrement(lastWeight * 0.9, increment);
    return {
      recommendedWeight: resetWeight,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: roundToIncrement(resetWeight * 0.5, 5),
      warmupReps: 10,
      reason: `It's been ${daysSinceLast} days since this one — easing back in a bit below your last working weight.`,
      isDeload: false,
      isFirstTime: false,
    };
  }

  if (wasVoluntaryReduction(lastWorkingSets)) {
    return {
      recommendedWeight: lastWeight,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: roundToIncrement(lastWeight * 0.5, 5),
      warmupReps: 10,
      reason: "You pulled back the weight last time — holding here before progressing again.",
      isDeload: false,
      isFirstTime: false,
    };
  }

  const stalledStreak = countConsecutiveStalls(recentSessions, repHigh);
  if (stalledStreak >= DELOAD_STALL_THRESHOLD) {
    const deloadWeight = roundToIncrement(lastWeight * 0.9, increment);
    return {
      recommendedWeight: deloadWeight,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: roundToIncrement(deloadWeight * 0.5, 5),
      warmupReps: 10,
      reason: `Progress has stalled for ${stalledStreak} sessions in a row — dialing back the weight to rebuild momentum.`,
      isDeload: true,
      isFirstTime: false,
    };
  }

  if (reachedTopOfRange(lastWorkingSets, repHigh)) {
    const nextWeight = lastWeight + increment;
    return {
      recommendedWeight: nextWeight,
      recommendedRepsLow: repLow,
      recommendedRepsHigh: repHigh,
      warmupWeight: roundToIncrement(nextWeight * 0.5, 5),
      warmupReps: 10,
      reason: `You hit the top of your rep range on every set last time, so today adds ${increment} lb.`,
      isDeload: false,
      isFirstTime: false,
    };
  }

  const missedMin = belowMinOfRange(lastWorkingSets, repLow);
  return {
    recommendedWeight: lastWeight,
    recommendedRepsLow: repLow,
    recommendedRepsHigh: repHigh,
    warmupWeight: roundToIncrement(lastWeight * 0.5, 5),
    warmupReps: 10,
    reason: missedMin
      ? "You missed the rep target last time — same weight today, focus on hitting the full range."
      : "Close last time — same weight today, aim to beat your total reps before we add weight.",
    isDeload: false,
    isFirstTime: false,
  };
}
