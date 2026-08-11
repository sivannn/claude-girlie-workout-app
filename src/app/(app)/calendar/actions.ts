"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { movementCategoryLabel } from "@/lib/data/movement-labels";
import { deleteCompletedWorkout } from "@/lib/data/workout-removal";
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

/**
 * The earliest day a workout may be scheduled for.
 *
 * "Today" is the user's today, not the server's: deployed servers run in UTC
 * while the calendar UI is built from the browser's clock, so a Pacific
 * evening is already tomorrow on the server and a strict server-side check
 * would reject the very day the UI just offered. The client passes its local
 * date; we accept it as long as it is within a day of the server's, which
 * keeps a forged value from backdating events arbitrarily.
 */
function earliestAllowedDate(clientToday: string | undefined): Date {
  const now = new Date();
  const serverToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!clientToday) return serverToday;
  const claimed = parseLocalDateInput(clientToday);
  const dayMs = 24 * 60 * 60 * 1000;
  const withinOneDay = Math.abs(claimed.getTime() - serverToday.getTime()) <= dayMs;
  return withinOneDay ? claimed : serverToday;
}

/**
 * User-initiated scheduling from the calendar day sheet: one planned event on
 * a chosen day. Today or future only — the reconciler auto-misses anything
 * scheduled in the past, so allowing it would create instantly-missed events.
 */
export async function scheduleWorkout(
  workoutTypeId: string,
  dateInput: string,
  clientToday?: string
): Promise<void> {
  const user = await getCurrentUser();
  await prisma.workoutType.findFirstOrThrow({ where: { id: workoutTypeId, userId: user.id } });
  const date = parseLocalDateInput(dateInput);
  if (date < earliestAllowedDate(clientToday)) {
    throw new Error("Workouts can only be scheduled for today or a future day.");
  }
  await prisma.workoutEvent.create({
    data: {
      userId: user.id,
      workoutTypeId,
      scheduledDate: date,
      status: "PLANNED",
      createdBy: "USER",
    },
  });
}

/** Removes a planned (or missed) event — the not-yet-done kind. Completed workouts go through removeCompletedWorkout. */
export async function removePlannedEvent(eventId: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.workoutEvent.deleteMany({
    where: { id: eventId, userId: user.id, status: { in: ["PLANNED", "MISSED"] } },
  });
}

/**
 * Hard-deletes a completed workout and syncs every surface that referenced
 * it — semantics and rationale live with the implementation in
 * src/lib/data/workout-removal.ts, where they are unit-tested.
 */
export async function removeCompletedWorkout(workoutId: string): Promise<void> {
  const user = await getCurrentUser();
  const removed = await deleteCompletedWorkout(prisma, user.id, workoutId);
  if (!removed) {
    throw new Error("Workout not found.");
  }
}

/**
 * Moves a planned workout to another day, or revives a missed one. Deletes
 * the old event and creates a fresh planned one so createdBy correctly
 * becomes USER either way.
 */
export async function rescheduleEvent(eventId: string, newDate: string, clientToday?: string) {
  const user = await getCurrentUser();
  const event = await prisma.workoutEvent.findFirstOrThrow({
    where: { id: eventId, userId: user.id, status: { in: ["PLANNED", "MISSED"] } },
  });
  const date = parseLocalDateInput(newDate);
  if (date < earliestAllowedDate(clientToday)) {
    throw new Error("Workouts can only be rescheduled to today or a future day.");
  }

  await prisma.$transaction([
    prisma.workoutEvent.delete({ where: { id: event.id } }),
    prisma.workoutEvent.create({
      data: {
        userId: user.id,
        workoutTypeId: event.workoutTypeId,
        scheduledDate: date,
        status: "PLANNED",
        createdBy: "USER",
      },
    }),
  ]);
}
