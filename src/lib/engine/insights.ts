export type ExerciseProgressPoint = {
  exerciseName: string;
  earliestWeight: number;
  currentBest: number;
  sessionCount: number;
};

export type HomeInsightInput = {
  exerciseProgress: ExerciseProgressPoint[];
  currentStreak: number;
  monthlyCompletedCount: number;
  monthlyTarget: number;
  totalWorkoutCount: number;
};

export type HomeInsightFact = {
  insightType: string;
  fact: string;
};

/**
 * Picks the single most meaningful, factual insight to show on the Home
 * page, in priority order. Every branch is grounded in a real number from
 * the user's history — per the spec, never a generic motivational line.
 */
export function pickHomeInsightFact(input: HomeInsightInput): HomeInsightFact | null {
  const bestProgress = input.exerciseProgress
    .filter((p) => p.sessionCount >= 2 && p.currentBest > p.earliestWeight)
    .sort((a, b) => b.currentBest - b.earliestWeight - (a.currentBest - a.earliestWeight))[0];

  if (bestProgress) {
    const delta = Math.round(bestProgress.currentBest - bestProgress.earliestWeight);
    return {
      insightType: "strength_trend",
      fact: `your ${bestProgress.exerciseName} has increased by ${delta} lb since you started using the app`,
    };
  }

  if (input.currentStreak >= 2) {
    return {
      insightType: "streak",
      fact: `you've completed all four weekly goals for ${input.currentStreak} weeks in a row`,
    };
  }

  if (input.monthlyTarget > 0 && input.monthlyCompletedCount / input.monthlyTarget >= 0.5) {
    return {
      insightType: "monthly_progress",
      fact: `you've completed ${input.monthlyCompletedCount} of your ${input.monthlyTarget}-workout monthly goal so far`,
    };
  }

  if (input.totalWorkoutCount > 0) {
    return {
      insightType: "total_count",
      fact: `you've completed ${input.totalWorkoutCount} workout${input.totalWorkoutCount === 1 ? "" : "s"} so far`,
    };
  }

  return null;
}
