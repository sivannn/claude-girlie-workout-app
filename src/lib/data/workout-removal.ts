import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Hard-deletes a completed workout and syncs everything that referenced it
 * (locked decision: hard delete with cleanup, no soft-delete columns):
 *
 *  - the Workout row (WorkoutExercise/WorkoutSet cascade at the DB level)
 *  - its COMPLETED WorkoutEvent, so the calendar doesn't keep a completed
 *    entry pointing at nothing (the FK alone would only null the link)
 *  - PR achievements earned in it (string refs, no FK). Older PR
 *    achievements from other workouts stay — they were true when earned —
 *    and every "current best" surface computes live from remaining data.
 *  - goals tracking an exercise from this workout: currentBest recomputed
 *    from what remains; milestones above the new best un-achieved; a goal
 *    completed by this workout drops back to ACTIVE and its completion
 *    achievement is removed.
 *
 * Lives outside the server-action file so the semantics are unit-testable
 * against a throwaway database (see workout-removal.test.ts).
 *
 * Returns false when the workout doesn't exist or isn't the user's.
 */
export async function deleteCompletedWorkout(
  prisma: PrismaClient,
  userId: string,
  workoutId: string
): Promise<boolean> {
  const workout = await prisma.workout.findFirst({
    where: { id: workoutId, userId },
    include: { exercises: { select: { exerciseId: true } }, event: { select: { id: true } } },
  });
  if (!workout) return false;
  const exerciseIds = [...new Set(workout.exercises.map((e) => e.exerciseId))];

  await prisma.$transaction(async (tx) => {
    await tx.achievement.deleteMany({
      where: { userId, type: "PR", relatedWorkoutId: workout.id },
    });
    if (workout.event) {
      await tx.workoutEvent.delete({ where: { id: workout.event.id } });
    }
    await tx.workout.delete({ where: { id: workout.id } });

    if (exerciseIds.length === 0) return;
    const goals = await tx.goal.findMany({
      where: { userId, exerciseId: { in: exerciseIds } },
      include: { milestones: true },
    });
    for (const goal of goals) {
      const remaining = await tx.workoutSet.aggregate({
        where: {
          actualWeight: { not: null },
          workoutExercise: { exerciseId: goal.exerciseId!, workout: { userId } },
        },
        _max: { actualWeight: true },
      });
      const newBest = Math.max(goal.startingValue, remaining._max.actualWeight ?? 0);
      const reopened = goal.status === "COMPLETED" && newBest < goal.targetValue;
      await tx.goal.update({
        where: { id: goal.id },
        data: {
          currentBest: newBest,
          ...(reopened ? { status: "ACTIVE", completedAt: null } : {}),
        },
      });
      const lapsedMilestones = goal.milestones.filter(
        (m) => m.achievedAt != null && m.value > newBest
      );
      if (lapsedMilestones.length > 0) {
        await tx.goalMilestone.updateMany({
          where: { id: { in: lapsedMilestones.map((m) => m.id) } },
          data: { achievedAt: null },
        });
      }
      if (reopened) {
        await tx.achievement.deleteMany({
          where: { userId, type: "GOAL_COMPLETED", relatedGoalId: goal.id },
        });
      }
    }
  });
  return true;
}
