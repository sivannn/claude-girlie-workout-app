import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dailyCalorieStatus } from "@/lib/engine/caloriesBurned";

export type LoggedMeal = {
  id: string;
  name: string;
  calories: number;
  source: string;
  loggedAt: Date;
};

export async function getCaloriesPageData(asOf = new Date()) {
  const user = await getCurrentUser();
  const dayStart = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const [meals, workouts] = await Promise.all([
    prisma.meal.findMany({
      where: { userId: user.id, date: { gte: dayStart, lt: dayEnd } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workout.findMany({
      where: { userId: user.id, date: { gte: dayStart, lt: dayEnd } },
      select: { caloriesBurned: true, workoutType: { select: { name: true } } },
    }),
  ]);

  const consumed = meals.reduce((sum, m) => sum + m.calories, 0);
  const burned = workouts.reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0);

  return {
    dailyTarget: user.preferences?.dailyCalorieTarget ?? null,
    status: dailyCalorieStatus({
      target: user.preferences?.dailyCalorieTarget,
      consumed,
      burned,
    }),
    consumed,
    burned,
    burnedFrom: workouts
      .filter((w) => (w.caloriesBurned ?? 0) > 0)
      .map((w) => w.workoutType.name),
    meals: meals.map(
      (m): LoggedMeal => ({
        id: m.id,
        name: m.name,
        calories: m.calories,
        source: m.source,
        loggedAt: m.createdAt,
      })
    ),
  };
}
