import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { EngineWorkoutSummary } from "@/lib/engine/types";
import type { WorkoutCategory } from "@/lib/types/enums";

/**
 * Every workout the user has logged, as engine summaries, newest first.
 *
 * Request-cached because the recommendation engine, the weekly goal
 * checklist, and the streak calculator all consume the same list — the
 * calendar page alone used to fetch it twice per render, each a full
 * round-trip to the remote database.
 *
 * Deliberately unbounded: longest-streak (streaks.ts) walks the whole
 * history, so a date cutoff here would silently cap that number.
 */
export const getWorkoutSummaries = cache(
  async (userId: string): Promise<EngineWorkoutSummary[]> => {
    const workouts = await prisma.workout.findMany({
      where: { userId },
      include: { workoutType: true },
      orderBy: { date: "desc" },
    });
    return workouts.map((w) => ({
      id: w.id,
      date: w.date,
      workoutTypeId: w.workoutTypeId,
      category: w.workoutType.category as WorkoutCategory,
      colorKey: w.workoutType.colorKey,
      trainingCategory: null,
      durationMinutes: w.durationMinutes,
    }));
  }
);
