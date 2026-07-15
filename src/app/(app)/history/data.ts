import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStreakStatus } from "@/lib/engine";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import type { WorkoutCategory } from "@/lib/types/enums";

export type HistoryFilters = {
  workoutTypeId?: string;
  category?: WorkoutCategory;
  prOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

export type WorkoutSetView = {
  setNumber: number;
  recommendedWeight: number | null;
  actualWeight: number | null;
  recommendedRepsLow: number | null;
  recommendedRepsHigh: number | null;
  actualReps: number | null;
  matchedRecommendation: boolean | null;
};

export type WorkoutExerciseView = {
  exerciseId: string;
  name: string;
  movementCategoryLabel: string;
  sets: WorkoutSetView[];
  weightIncreased: boolean;
  repsIncreased: boolean;
  changeSummary: string;
};

export type WorkoutListItem = {
  id: string;
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  category: WorkoutCategory;
  date: Date;
  durationMinutes: number;
  exerciseCount: number;
  summary: string | null;
  hasPR: boolean;
  exercises: WorkoutExerciseView[];
  cardioIndoorOutdoor: string | null;
  cardioTimeSeconds: number | null;
  cardioDistanceMiles: number | null;
  notes: string | null;
};

function representativeBest(sets: { actualWeight: number | null; actualReps: number | null }[]) {
  const weights = sets.filter((s) => s.actualWeight != null).map((s) => s.actualWeight!);
  const reps = sets.filter((s) => s.actualReps != null).map((s) => s.actualReps!);
  return {
    weight: weights.length ? Math.max(...weights) : null,
    reps: reps.length ? Math.max(...reps) : null,
  };
}

export async function getHistoryPageData(filters: HistoryFilters) {
  const user = await getCurrentUser();

  const [allWorkouts, prAchievements, workoutTypes] = await Promise.all([
    prisma.workout.findMany({
      where: { userId: user.id },
      include: {
        workoutType: true,
        exercises: {
          include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
          orderBy: { orderIndex: "asc" },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.achievement.findMany({
      where: { userId: user.id, type: "PR", relatedWorkoutId: { not: null } },
      select: { relatedWorkoutId: true },
    }),
    prisma.workoutType.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
  ]);

  const prWorkoutIds = new Set(prAchievements.map((a) => a.relatedWorkoutId));

  // Build chronological (ascending) best-so-far per exercise to compute
  // per-workout, per-exercise "change vs last workout" indicators.
  const ascending = [...allWorkouts].reverse();
  const bestSoFarByExercise = new Map<string, { weight: number | null; reps: number | null }>();
  const exerciseViewsByWorkout = new Map<string, WorkoutExerciseView[]>();

  for (const w of ascending) {
    const views: WorkoutExerciseView[] = [];
    for (const we of w.exercises) {
      const { weight, reps } = representativeBest(we.sets);
      const prior = bestSoFarByExercise.get(we.exerciseId) ?? { weight: null, reps: null };
      const weightIncreased = weight != null && prior.weight != null && weight > prior.weight;
      const repsIncreased = reps != null && prior.reps != null && reps > prior.reps;

      let changeSummary = "First time logging this exercise.";
      if (prior.weight != null) {
        if (weightIncreased) {
          changeSummary = `+${Math.round((weight! - prior.weight) * 10) / 10} lb from last session`;
        } else if (weight != null && weight === prior.weight) {
          changeSummary = repsIncreased ? "Same weight, more reps than last time" : "Matched last session";
        } else if (weight != null && weight < prior.weight) {
          changeSummary = "Lighter than last session";
        }
      }

      views.push({
        exerciseId: we.exerciseId,
        name: we.exercise.name,
        movementCategoryLabel: movementCategoryLabel(we.movementCategory as never),
        sets: we.sets.map((s) => ({
          setNumber: s.setNumber,
          recommendedWeight: s.recommendedWeight,
          actualWeight: s.actualWeight,
          recommendedRepsLow: s.recommendedRepsLow,
          recommendedRepsHigh: s.recommendedRepsHigh,
          actualReps: s.actualReps,
          matchedRecommendation: s.matchedRecommendation,
        })),
        weightIncreased,
        repsIncreased,
        changeSummary,
      });

      if (weight != null || reps != null) {
        bestSoFarByExercise.set(we.exerciseId, {
          weight: weight != null ? Math.max(weight, prior.weight ?? 0) : prior.weight,
          reps: reps != null ? Math.max(reps, prior.reps ?? 0) : prior.reps,
        });
      }
    }
    exerciseViewsByWorkout.set(w.id, views);
  }

  let items: WorkoutListItem[] = allWorkouts.map((w) => ({
    id: w.id,
    workoutTypeId: w.workoutTypeId,
    workoutTypeName: w.workoutType.name,
    colorKey: w.workoutType.colorKey,
    category: w.workoutType.category as WorkoutCategory,
    date: w.date,
    durationMinutes: w.durationMinutes,
    exerciseCount: w.exercises.length,
    summary: w.aiRecapText,
    hasPR: prWorkoutIds.has(w.id),
    exercises: exerciseViewsByWorkout.get(w.id) ?? [],
    cardioIndoorOutdoor: w.cardioIndoorOutdoor,
    cardioTimeSeconds: w.cardioTimeSeconds,
    cardioDistanceMiles: w.cardioDistanceMiles,
    notes: w.notes,
  }));

  // Global insights are always computed from the full, unfiltered history.
  const totalWorkouts = items.length;
  const typeFrequency = new Map<string, number>();
  for (const w of items) typeFrequency.set(w.workoutTypeName, (typeFrequency.get(w.workoutTypeName) ?? 0) + 1);
  const mostFrequentType =
    [...typeFrequency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const exerciseDeltas = new Map<string, { name: string; first: number; best: number }>();
  for (const w of ascending) {
    for (const we of w.exercises) {
      const { weight } = representativeBest(we.sets);
      if (weight == null) continue;
      const existing = exerciseDeltas.get(we.exerciseId);
      if (!existing) {
        exerciseDeltas.set(we.exerciseId, { name: we.exercise.name, first: weight, best: weight });
      } else {
        existing.best = Math.max(existing.best, weight);
      }
    }
  }
  const mostImproved = [...exerciseDeltas.values()]
    .map((e) => ({ name: e.name, delta: e.best - e.first }))
    .sort((a, b) => b.delta - a.delta)[0];

  const streak = getStreakStatus(
    items.map((w) => ({
      id: w.id,
      date: w.date,
      workoutTypeId: w.id,
      category: w.category,
      colorKey: w.colorKey,
      trainingCategory: null,
    })),
    { legDay: 1, upperBody: 1, cardio: 1, fun: 1 },
    new Date()
  );

  // Apply filters after computing global insights.
  if (filters.workoutTypeId) items = items.filter((w) => w.workoutTypeId === filters.workoutTypeId);
  if (filters.category) items = items.filter((w) => w.category === filters.category);
  if (filters.prOnly) items = items.filter((w) => w.hasPR);
  if (filters.dateFrom) items = items.filter((w) => w.date >= new Date(filters.dateFrom!));
  if (filters.dateTo) items = items.filter((w) => w.date <= new Date(filters.dateTo!));

  return {
    items,
    workoutTypes: workoutTypes.map((t) => ({ id: t.id, name: t.name })),
    insights: {
      totalWorkouts,
      mostImprovedExercise: mostImproved && mostImproved.delta > 0 ? mostImproved : null,
      longestStreak: streak.longestStreak,
      mostFrequentType,
    },
  };
}
