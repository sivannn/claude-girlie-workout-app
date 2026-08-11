import "server-only";
import { prisma } from "@/lib/prisma";
import { filterExercisesByEquipment } from "@/lib/data/equipment";
import { provisionUserLibrary } from "@/lib/data/provisioning";
import {
  generateTrainingPlan,
  planPositionOn,
  type GeneratedPlan,
  type PlanCandidateExercise,
  type PlanPosition,
} from "@/lib/engine/planGenerator";
import { BLOCK_FOCUS_DESCRIPTION, BLOCK_FOCUS_LABEL } from "@/lib/engine/blockPrescriptions";
import { SPLIT_LABEL } from "@/lib/engine/weeklySplit";
import type {
  BlockFocus,
  BlockFocusStyle,
  DeloadPreference,
  EquipmentAccess,
  ExperienceLevel,
  InjuryArea,
  MuscleGroup,
  PrimaryGoal,
  WeeklySplit,
} from "@/lib/types/enums";

function parseJsonList<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Generates a plan from the user's questionnaire answers and persists it,
 * archiving any plan already running. Returns null when the user hasn't
 * answered enough of the questionnaire to plan against.
 */
export async function createPlanForUser(userId: string): Promise<string | null> {
  const preferences = await prisma.userPreferences.findUnique({ where: { userId } });
  if (!preferences?.primaryGoal || !preferences.trainingDaysPerWeek) return null;

  // Accounts provisioned before the periodization library shipped hold
  // untagged exercise rows, which the generator can't select from (and are
  // missing the newer exercises entirely). Re-running the idempotent
  // provisioning backfills the tags and adds what's missing, so an existing
  // user's first plan isn't empty.
  const taggedCount = await prisma.exercise.count({
    where: { userId, isCustom: false, muscleGroup: { not: null } },
  });
  if (taggedCount === 0) {
    await provisionUserLibrary(prisma, userId);
  }

  const exercises = await prisma.exercise.findMany({
    where: { userId, isCustom: false },
  });
  const equipmentFiltered = filterExercisesByEquipment(
    exercises,
    (preferences.equipmentAccess ?? "commercial_gym") as EquipmentAccess
  );
  const candidates: PlanCandidateExercise[] = equipmentFiltered.map((e) => ({
    id: e.id,
    name: e.name,
    muscleGroup: e.muscleGroup as MuscleGroup | null,
    movementCategory: e.movementCategory,
    kind: e.kind,
    exerciseType: e.exerciseType as PlanCandidateExercise["exerciseType"],
    difficultyTier: e.difficultyTier as PlanCandidateExercise["difficultyTier"],
    contraindications: parseJsonList<InjuryArea>(e.contraindications),
    equipment: e.equipment,
  }));

  const generated = generateTrainingPlan({
    goal: preferences.primaryGoal as PrimaryGoal,
    trainingDaysPerWeek: preferences.trainingDaysPerWeek,
    experienceLevel: (preferences.experienceLevel ?? "new") as ExperienceLevel,
    injuryAreas: parseJsonList<InjuryArea>(preferences.injuryAreas),
    blockDurationWeeks: preferences.blockDurationWeeks ?? 6,
    blockCount: preferences.blockCount ?? 3,
    blockFocusStyle: (preferences.blockFocusStyle ?? "balanced") as BlockFocusStyle,
    deloadPreference: (preferences.deloadPreference ?? "scheduled") as DeloadPreference,
    availableExercises: candidates,
  });

  return persistPlan(userId, generated);
}

async function persistPlan(userId: string, generated: GeneratedPlan): Promise<string> {
  return prisma.$transaction(async (tx) => {
    // Only one plan drives the app at a time; previous plans stay for history.
    await tx.trainingPlan.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "ARCHIVED" },
    });

    const plan = await tx.trainingPlan.create({
      data: {
        userId,
        name: generated.name,
        goal: generated.goal,
        split: generated.split,
        trainingDaysPerWeek: generated.trainingDaysPerWeek,
        durationWeeks: generated.durationWeeks,
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });

    for (const block of generated.blocks) {
      const created = await tx.planBlock.create({
        data: {
          planId: plan.id,
          orderIndex: block.orderIndex,
          focus: block.focus,
          durationWeeks: block.durationWeeks,
          hasDeloadWeek: block.hasDeloadWeek,
          setsLow: block.prescription.setsLow,
          setsHigh: block.prescription.setsHigh,
          repRangeLow: block.prescription.repRangeLow,
          repRangeHigh: block.prescription.repRangeHigh,
          restSecondsLow: block.prescription.restSecondsLow,
          restSecondsHigh: block.prescription.restSecondsHigh,
        },
      });
      for (const day of block.days) {
        await tx.planDay.create({
          data: {
            blockId: created.id,
            dayIndex: day.dayIndex,
            dayOffset: day.dayOffset,
            dayLabel: day.dayLabel,
            muscleGroupsJson: JSON.stringify(day.muscleGroups),
            exercises: {
              create: day.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                orderIndex: ex.orderIndex,
              })),
            },
          },
        });
      }
    }
    return plan.id;
  });
}

export type ActivePlanView = {
  id: string;
  name: string;
  split: WeeklySplit;
  splitLabel: string;
  durationWeeks: number;
  trainingDaysPerWeek: number;
  startedAt: Date;
  position: PlanPosition;
  currentBlock: {
    focus: BlockFocus;
    focusLabel: string;
    focusDescription: string;
    orderIndex: number;
    durationWeeks: number;
    setsLow: number;
    setsHigh: number;
    repRangeLow: number;
    repRangeHigh: number;
    restSecondsLow: number;
    restSecondsHigh: number;
  };
  blockCount: number;
  /** This week's sessions, in order, with completion state for the checklist. */
  weekDays: Array<{
    dayIndex: number;
    dayLabel: string;
    muscleGroups: MuscleGroup[];
    exerciseCount: number;
  }>;
};

/**
 * The user's active plan and where they are inside it, or null when no plan
 * is running — every consumer falls back to the pre-plan recommendation
 * engine in that case.
 */
export async function getActivePlan(userId: string, asOf = new Date()): Promise<ActivePlanView | null> {
  const plan = await prisma.trainingPlan.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      blocks: {
        orderBy: { orderIndex: "asc" },
        include: {
          days: {
            orderBy: { dayIndex: "asc" },
            include: { exercises: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
    },
  });
  if (!plan || plan.blocks.length === 0) return null;

  const position = planPositionOn(
    { blocks: plan.blocks.map((b) => ({ durationWeeks: b.durationWeeks, hasDeloadWeek: b.hasDeloadWeek })) },
    plan.startedAt,
    asOf
  );

  // A finished plan stops driving the app; it's marked COMPLETED so the
  // fallback engine takes over until the user generates a new one.
  if (position.isComplete) {
    await prisma.trainingPlan.update({
      where: { id: plan.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return null;
  }

  const block = plan.blocks[position.blockIndex];
  return {
    id: plan.id,
    name: plan.name,
    split: plan.split as WeeklySplit,
    splitLabel: SPLIT_LABEL[plan.split as WeeklySplit] ?? plan.split,
    durationWeeks: plan.durationWeeks,
    trainingDaysPerWeek: plan.trainingDaysPerWeek,
    startedAt: plan.startedAt,
    position,
    currentBlock: {
      focus: block.focus as BlockFocus,
      focusLabel: BLOCK_FOCUS_LABEL[block.focus as BlockFocus] ?? block.focus,
      focusDescription: BLOCK_FOCUS_DESCRIPTION[block.focus as BlockFocus] ?? "",
      orderIndex: block.orderIndex,
      durationWeeks: block.durationWeeks,
      setsLow: block.setsLow,
      setsHigh: block.setsHigh,
      repRangeLow: block.repRangeLow,
      repRangeHigh: block.repRangeHigh,
      restSecondsLow: block.restSecondsLow,
      restSecondsHigh: block.restSecondsHigh,
    },
    blockCount: plan.blocks.length,
    weekDays: block.days.map((d) => ({
      dayIndex: d.dayIndex,
      dayLabel: d.dayLabel,
      muscleGroups: parseJsonList<MuscleGroup>(d.muscleGroupsJson),
      exerciseCount: d.exercises.length,
    })),
  };
}

/**
 * Puts this week's plan sessions on the calendar as PLANNED events, so the
 * plan is something the user can act on rather than a poster on the Home
 * page. Idempotent: a day that already has any event is left alone, so
 * user-scheduled and already-completed workouts are never disturbed.
 */
export async function materializePlanWeek(
  userId: string,
  plan: ActivePlanView,
  asOf = new Date()
): Promise<number> {
  const weekStart = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  // Anchor the plan week to the plan's own start day so sessions land on the
  // same weekdays every week.
  const dayOfWeekOffset = Math.floor(
    (Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate()) -
      Date.UTC(plan.startedAt.getFullYear(), plan.startedAt.getMonth(), plan.startedAt.getDate())) /
      (24 * 60 * 60 * 1000)
  ) % 7;
  weekStart.setDate(weekStart.getDate() - dayOfWeekOffset);

  const planDays = await prisma.planDay.findMany({
    where: { block: { plan: { id: plan.id } }, dayIndex: { in: plan.weekDays.map((d) => d.dayIndex) } },
    include: { block: true },
  });

  // The lifting workout type the plan session maps onto — plan days are
  // muscle-group based, so pick the closest existing type for the calendar.
  const workoutTypes = await prisma.workoutType.findMany({
    where: { userId, category: "WEIGHTLIFTING" },
  });
  if (workoutTypes.length === 0) return 0;

  let created = 0;
  for (const day of plan.weekDays) {
    const planDay = planDays.find(
      (d) => d.dayIndex === day.dayIndex && d.block.orderIndex === plan.currentBlock.orderIndex
    );
    if (!planDay) continue;
    const date = new Date(weekStart);
    date.setDate(date.getDate() + planDay.dayOffset);
    if (date < new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())) continue;

    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const existing = await prisma.workoutEvent.count({
      where: { userId, scheduledDate: { gte: dayStart, lt: dayEnd } },
    });
    if (existing > 0) continue;

    const type = pickWorkoutTypeForDay(day.muscleGroups, workoutTypes);
    await prisma.workoutEvent.create({
      data: {
        userId,
        workoutTypeId: type.id,
        scheduledDate: dayStart,
        status: "PLANNED",
        createdBy: "AI",
      },
    });
    created++;
  }
  return created;
}

/** Maps a plan day's muscle groups onto the user's existing workout types. */
function pickWorkoutTypeForDay(
  muscleGroups: MuscleGroup[],
  types: Array<{ id: string; colorKey: string; name: string }>
): { id: string; colorKey: string; name: string } {
  const wantsLegs = muscleGroups.includes("legs");
  const wantsBack = muscleGroups.includes("back");
  const preferredColorKey = wantsLegs ? "glutes_legs" : wantsBack ? "back_biceps" : "chest_triceps";
  return types.find((t) => t.colorKey === preferredColorKey) ?? types[0];
}

/** Drops the active plan without generating a replacement. */
export async function archiveActivePlan(userId: string): Promise<void> {
  await prisma.trainingPlan.updateMany({
    where: { userId, status: "ACTIVE" },
    data: { status: "ARCHIVED" },
  });
}
