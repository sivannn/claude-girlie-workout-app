import { PageHeader } from "@/components/shared/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CATEGORY_NAME } from "@/lib/data/category-descriptions";
import type { TrainingCategory } from "@/lib/types/enums";
import { StartingWeightsForm, type StartingWeightRow } from "./StartingWeightsForm";

export const dynamic = "force-dynamic";

/**
 * The compound lifts worth calibrating up front. Deliberately not the whole
 * 187-exercise library — this should take a minute, not an afternoon, and
 * accessories calibrate themselves quickly from one logged session.
 */
const KEY_MOVEMENT_CATEGORIES = [
  "squat_lunge",
  "hip_hinge",
  "hip_thrust_bridge",
  "horizontal_push",
  "vertical_push",
  "vertical_pull",
  "horizontal_pull",
];

export default async function StartingWeightsPage() {
  const user = await getCurrentUser();

  const [exercises, preferences, loggedExerciseIds] = await Promise.all([
    prisma.exercise.findMany({
      where: {
        userId: user.id,
        isCustom: false,
        kind: "STRENGTH",
        movementCategory: { in: KEY_MOVEMENT_CATEGORIES },
        exerciseType: "compound",
      },
      orderBy: [{ workoutCategory: "asc" }, { name: "asc" }],
    }),
    prisma.exercisePreference.findMany({ where: { userId: user.id } }),
    prisma.workoutExercise
      .findMany({
        where: { workout: { userId: user.id } },
        select: { exerciseId: true },
        distinct: ["exerciseId"],
      })
      .then((rows) => new Set(rows.map((r) => r.exerciseId))),
  ]);

  const knownById = new Map(
    preferences.map((p) => [p.exerciseId, p.knownStartingWeightLb ?? null])
  );

  // Every compound in these patterns would be ~65 inputs, which is a chore
  // rather than the minute this should take. Keep the few per pattern someone
  // is most likely to know a number for, preferring the loaded barbell and
  // dumbbell staples, and always keep anything already filled in.
  const EQUIPMENT_RANK: Record<string, number> = {
    barbell: 5,
    dumbbell: 4,
    machine: 3,
    cable: 2,
    bodyweight: 1,
  };
  const PER_PATTERN = 3;
  const byPattern = new Map<string, typeof exercises>();
  for (const e of exercises) {
    const list = byPattern.get(e.movementCategory) ?? [];
    list.push(e);
    byPattern.set(e.movementCategory, list);
  }
  const shortlist = [...byPattern.values()].flatMap((list) =>
    list
      .slice()
      .sort(
        (a, b) =>
          (EQUIPMENT_RANK[b.equipment ?? ""] ?? 0) - (EQUIPMENT_RANK[a.equipment ?? ""] ?? 0) ||
          a.name.localeCompare(b.name)
      )
      .filter((e, i) => i < PER_PATTERN || knownById.get(e.id) != null || loggedExerciseIds.has(e.id))
  );
  shortlist.sort((a, b) => a.workoutCategory.localeCompare(b.workoutCategory) || a.name.localeCompare(b.name));

  const rows: StartingWeightRow[] = shortlist.map((e) => ({
    exerciseId: e.id,
    name: e.name,
    categoryLabel:
      CATEGORY_NAME[e.workoutCategory as TrainingCategory] ?? e.workoutCategory,
    current: knownById.get(e.id) ?? null,
    hasHistory: loggedExerciseIds.has(e.id),
  }));

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title="Starting Weights"
        subtitle="Tell Alex what you can already lift and he'll start there, instead of working up to it over a few sessions."
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Fill in whatever you know — a comfortable working weight for a set of 8–10 is perfect. Leave
        the rest blank. Anything you&apos;ve already logged is learned from your real sessions and
        can&apos;t be overridden here.
      </p>
      <StartingWeightsForm rows={rows} />
    </div>
  );
}
