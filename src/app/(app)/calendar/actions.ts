"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import { parseLocalDateInput } from "@/lib/utils/date";

export type WorkoutDetailSet = {
  setNumber: number;
  recommendedWeight: number | null;
  actualWeight: number | null;
  recommendedRepsLow: number | null;
  recommendedRepsHigh: number | null;
  actualReps: number | null;
};

export type WorkoutDetailExercise = {
  name: string;
  movementCategoryLabel: string;
  changeSummary: string;
  improved: boolean;
  sets: WorkoutDetailSet[];
};

export type WorkoutDetail = {
  exercises: WorkoutDetailExercise[];
  notes: string | null;
  hasPR: boolean;
  cardioIndoorOutdoor: string | null;
  cardioTimeSeconds: number | null;
  cardioDistanceMiles: number | null;
};

function bestActualWeight(sets: Array<{ actualWeight: number | null }>): number | null {
  const weights = sets.filter((s) => s.actualWeight != null).map((s) => s.actualWeight!);
  return weights.length ? Math.max(...weights) : null;
}

/**
 * The set-by-set journal view for one completed workout, opened from the
 * calendar's day sheet (this is the detail the old History page used to
 * show). "Change" compares against the most recent prior session of the same
 * exercise, looked up with one bounded single-row query per exercise instead
 * of scanning the full history.
 */
export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetail | null> {
  const user = await getCurrentUser();
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId: user.id },
    include: {
      exercises: {
        include: { exercise: true, sets: { orderBy: { setNumber: "asc" } } },
        orderBy: { orderIndex: "asc" },
      },
    },
  });
  if (!workout) return null;

  const exerciseIds = workout.exercises.map((we) => we.exerciseId);
  const [priorExercises, prCount] = await Promise.all([
    Promise.all(
      exerciseIds.map((exerciseId) =>
        prisma.workoutExercise.findFirst({
          where: {
            exerciseId,
            workout: { userId: user.id, date: { lt: workout.date } },
            sets: { some: { actualWeight: { not: null } } },
          },
          include: { sets: true },
          orderBy: { workout: { date: "desc" } },
        })
      )
    ),
    prisma.achievement.count({ where: { userId: user.id, type: "PR", relatedWorkoutId: workout.id } }),
  ]);

  const previousBest = new Map<string, number>();
  for (const prior of priorExercises) {
    if (!prior) continue;
    const best = bestActualWeight(prior.sets);
    if (best != null) previousBest.set(prior.exerciseId, best);
  }

  const exercises: WorkoutDetailExercise[] = workout.exercises.map((we) => {
    const best = bestActualWeight(we.sets);
    const prior = previousBest.get(we.exerciseId);
    let changeSummary = "First time logging this exercise";
    let improved = false;
    if (prior != null && best != null) {
      if (best > prior) {
        changeSummary = `+${Math.round((best - prior) * 10) / 10} lb from last session`;
        improved = true;
      } else if (best === prior) {
        changeSummary = "Matched last session";
      } else {
        changeSummary = "Lighter than last session";
      }
    } else if (best == null) {
      changeSummary = "";
    }
    return {
      name: we.exercise.name,
      movementCategoryLabel: movementCategoryLabel(we.movementCategory as never),
      changeSummary,
      improved,
      sets: we.sets.map((s) => ({
        setNumber: s.setNumber,
        recommendedWeight: s.recommendedWeight,
        actualWeight: s.actualWeight,
        recommendedRepsLow: s.recommendedRepsLow,
        recommendedRepsHigh: s.recommendedRepsHigh,
        actualReps: s.actualReps,
      })),
    };
  });

  return {
    exercises,
    notes: workout.notes,
    hasPR: prCount > 0,
    cardioIndoorOutdoor: workout.cardioIndoorOutdoor,
    cardioTimeSeconds: workout.cardioTimeSeconds,
    cardioDistanceMiles: workout.cardioDistanceMiles,
  };
}

/** Missed-workout reschedule: remove the missed event, create a new planned one at the chosen date. */
export async function rescheduleEvent(eventId: string, newDate: string) {
  const user = await getCurrentUser();
  const event = await prisma.workoutEvent.findFirstOrThrow({
    where: { id: eventId, userId: user.id, status: "MISSED" },
  });

  await prisma.$transaction([
    prisma.workoutEvent.delete({ where: { id: event.id } }),
    prisma.workoutEvent.create({
      data: {
        userId: user.id,
        workoutTypeId: event.workoutTypeId,
        scheduledDate: parseLocalDateInput(newDate),
        status: "PLANNED",
        createdBy: "USER",
      },
    }),
  ]);
}
