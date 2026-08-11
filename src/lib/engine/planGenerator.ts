import type {
  BlockFocus,
  BlockFocusStyle,
  DeloadPreference,
  DifficultyTier,
  ExperienceLevel,
  ExerciseType,
  InjuryArea,
  MuscleGroup,
  PrimaryGoal,
  WeeklySplit,
} from "@/lib/types/enums";
import {
  BLOCK_PRESCRIPTIONS,
  blockHasDeloadWeek,
  type BlockPrescription,
} from "./blockPrescriptions";
import { buildBlockSequence } from "./blockSequence";
import {
  splitForTrainingDays,
  trainingDayOffsets,
  weeklyScheduleFor,
  type PlanDayTemplate,
} from "./weeklySplit";

/**
 * The Block Periodization plan generator.
 *
 * Pure function, no Prisma or AI imports, in keeping with the rest of
 * src/lib/engine — server actions fetch the data, this shapes the plan, and
 * the AI layer only ever narrates the result.
 *
 * A plan stores *intent* (which muscle groups, which exercises, what rep/set
 * prescription) rather than concrete weights, so a plan written two months
 * ago can never contradict what the user is actually lifting today.
 *
 * Scope note: plan sessions are scheduled onto the calendar and surfaced on
 * Home, but the workout screen still selects exercises and resolves weights
 * from the per-session engine — it does not yet read the plan's own exercise
 * list or block prescription. That wiring is the remaining step.
 */

export type PlanExercise = {
  exerciseId: string;
  name: string;
  muscleGroup: MuscleGroup;
  exerciseType: ExerciseType;
  orderIndex: number;
  /** Prescription for this exercise in this block. */
  setsLow: number;
  setsHigh: number;
  repRangeLow: number;
  repRangeHigh: number;
  restSecondsLow: number;
  restSecondsHigh: number;
};

export type PlanDay = {
  dayIndex: number; // 0-based position within the training week
  dayOffset: number; // days from the start of the week
  dayLabel: string;
  muscleGroups: MuscleGroup[];
  exercises: PlanExercise[];
};

export type PlanBlockSpec = {
  orderIndex: number;
  focus: BlockFocus;
  durationWeeks: number;
  /** Final week of the block is a planned deload. */
  hasDeloadWeek: boolean;
  prescription: BlockPrescription;
  days: PlanDay[];
};

export type GeneratedPlan = {
  name: string;
  goal: PrimaryGoal;
  split: WeeklySplit;
  trainingDaysPerWeek: number;
  durationWeeks: number;
  blocks: PlanBlockSpec[];
};

export type PlanCandidateExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  /** Used to avoid two variants of the same pattern in one session. */
  movementCategory?: string | null;
  /** "STRENGTH" | "CARDIO" — cardio modalities are never prescribed as lifts. */
  kind?: string | null;
  exerciseType: ExerciseType | null;
  difficultyTier: DifficultyTier | null;
  contraindications: InjuryArea[];
  equipment: string | null;
};

export type PlanGeneratorInput = {
  goal: PrimaryGoal;
  trainingDaysPerWeek: number;
  experienceLevel: ExperienceLevel;
  injuryAreas: InjuryArea[];
  blockDurationWeeks: number;
  blockCount: number;
  blockFocusStyle: BlockFocusStyle;
  deloadPreference: DeloadPreference;
  /** Already filtered by the user's equipment access before being passed in. */
  availableExercises: PlanCandidateExercise[];
};

const TIER_RANK: Record<DifficultyTier, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/** The hardest tier a user should be prescribed unattended. */
function maxTierFor(experience: ExperienceLevel): number {
  switch (experience) {
    case "new":
      return TIER_RANK.beginner;
    case "under_1_year":
      return TIER_RANK.intermediate;
    default:
      return TIER_RANK.advanced;
  }
}

/**
 * Block focus changes what kind of exercise belongs in the session:
 * hypertrophy wants compounds plus isolation volume, strength wants heavy
 * compounds, power wants compounds only, conditioning leans lighter.
 */
const FOCUS_TYPE_WEIGHT: Record<BlockFocus, Record<ExerciseType, number>> = {
  // Compound outranks isolation everywhere it matters: tied weights would let
  // equipment rank and alphabetical order choose, which quietly dropped
  // vertical pulling out of hypertrophy back days.
  hypertrophy: { compound: 4, isolation: 3, accessory: 2 },
  strength: { compound: 5, isolation: 1, accessory: 1 },
  power: { compound: 5, isolation: 0, accessory: 1 },
  conditioning: { compound: 2, isolation: 3, accessory: 3 },
};

export function isExerciseAllowed(
  exercise: PlanCandidateExercise,
  injuryAreas: InjuryArea[],
  experience: ExperienceLevel
): boolean {
  if (!exercise.muscleGroup || !exercise.exerciseType || !exercise.difficultyTier) return false;
  // Cardio modalities are tagged with muscle groups so they show up in the
  // library, but they are not lifts — prescribing an elliptical for "4 sets
  // of 3-5 reps with 3 minutes rest" is nonsense.
  if (exercise.kind === "CARDIO") return false;
  // Injury filtering is absolute: if a lift loads a flagged joint, it never
  // gets prescribed.
  if (exercise.contraindications.some((area) => injuryAreas.includes(area))) return false;
  if (TIER_RANK[exercise.difficultyTier] > maxTierFor(experience)) return false;
  return true;
}

/**
 * Picks the exercises for one day of one block.
 *
 * Spreads across the day's muscle groups (round-robin so nothing is starved),
 * scores candidates by how well their type suits the block focus, and prefers
 * exercises not already used elsewhere in the same block so a plan doesn't
 * repeat the same five lifts every session.
 */
function selectDayExercises(
  template: PlanDayTemplate,
  focus: BlockFocus,
  candidates: PlanCandidateExercise[],
  usedInBlock: Set<string>
): PlanCandidateExercise[] {
  const weights = FOCUS_TYPE_WEIGHT[focus];
  const byGroup = new Map<MuscleGroup, PlanCandidateExercise[]>();

  for (const group of template.muscleGroups) {
    const pool = candidates
      .filter((c) => c.muscleGroup === group)
      .filter((c) => !template.excludeMovementCategories?.includes(c.movementCategory ?? ""))
      // A zero focus weight (isolation in a power block) *demotes* rather than
      // excludes: better a power day ends with an isolation lift than comes up
      // short because no compound was left for that muscle group.
      .sort((a, b) => {
        // Prefer exercises this block hasn't used yet, then the type that
        // suits the focus, then the more substantial implement — otherwise
        // ties resolve alphabetically and every plan opens with band work.
        const freshness = Number(usedInBlock.has(a.id)) - Number(usedInBlock.has(b.id));
        if (freshness !== 0) return freshness;
        const weight = weights[b.exerciseType!] - weights[a.exerciseType!];
        if (weight !== 0) return weight;
        const implement = equipmentRank(b.equipment) - equipmentRank(a.equipment);
        if (implement !== 0) return implement;
        return a.name.localeCompare(b.name);
      });
    byGroup.set(group, pool);
  }

  const picked: PlanCandidateExercise[] = [];
  const takenIds = new Set<string>();
  // One exercise per movement pattern per session: without this a day can
  // pair "Assisted Pull-Up" with "Band-Assisted Pull-Up" and call it variety.
  const takenPatterns = new Set<string>();
  let groupIndex = 0;
  let guard = 0;

  // At most two heavy compounds per muscle group in a session. Squat plus
  // conventional deadlift plus hip thrust in one workout is more systemic
  // fatigue than a session should carry, however well it scores.
  const MAX_COMPOUNDS_PER_GROUP = 2;
  const compoundsByGroup = new Map<MuscleGroup, number>();

  const takeFrom = (group: MuscleGroup, allowPatternRepeat: boolean): boolean => {
    const pool = byGroup.get(group);
    if (!pool || pool.length === 0) return false;
    const compoundsUsed = compoundsByGroup.get(group) ?? 0;
    const pick = (allowExtraCompound: boolean) =>
      pool.find(
        (c) =>
          !takenIds.has(c.id) &&
          (allowPatternRepeat || !c.movementCategory || !takenPatterns.has(c.movementCategory)) &&
          (allowExtraCompound ||
            c.exerciseType !== "compound" ||
            compoundsUsed < MAX_COMPOUNDS_PER_GROUP)
      );
    // Only exceed the compound cap if the group has literally nothing else.
    const next = pick(false) ?? pick(true);
    if (!next) return false;
    takenIds.add(next.id);
    if (next.movementCategory) takenPatterns.add(next.movementCategory);
    if (next.exerciseType === "compound") compoundsByGroup.set(group, compoundsUsed + 1);
    picked.push(next);
    return true;
  };

  // The slot belongs to whichever group's turn it is. If that group has no
  // *fresh* movement pattern left, relax the pattern rule for that same group
  // rather than handing the slot to the next one — otherwise a group with many
  // patterns (legs) swallows the slots a group with few (core) should have had,
  // and a Lower day becomes four heavy leg compounds in a row.
  while (picked.length < template.exerciseCount && guard < template.exerciseCount * 12) {
    guard++;
    const group = template.muscleGroups[groupIndex % template.muscleGroups.length];
    groupIndex++;
    if (takeFrom(group, false)) continue;
    takeFrom(group, true);
  }
  // Small libraries (heavy injury filtering, bodyweight-only) may still leave
  // a short day: sweep every group rather than ship fewer exercises.
  guard = 0;
  while (picked.length < template.exerciseCount && guard < template.exerciseCount * 12) {
    guard++;
    const before = picked.length;
    for (const group of template.muscleGroups) {
      if (picked.length >= template.exerciseCount) break;
      takeFrom(group, true);
    }
    if (picked.length === before) break; // nothing left anywhere
  }

  // Heavy compounds first, the way a real session is ordered.
  const typeOrder: Record<ExerciseType, number> = { compound: 0, accessory: 1, isolation: 2 };
  return picked.sort((a, b) => typeOrder[a.exerciseType!] - typeOrder[b.exerciseType!]);
}

/** Barbell/machine work anchors a session; bands are the fallback implement. */
function equipmentRank(equipment: string | null): number {
  switch (equipment) {
    case "barbell":
      return 5;
    case "dumbbell":
      return 4;
    case "machine":
      return 3;
    case "cable":
      return 2;
    case "bodyweight":
      return 1;
    default:
      return 0;
  }
}

export function generateTrainingPlan(input: PlanGeneratorInput): GeneratedPlan {
  const split = splitForTrainingDays(input.trainingDaysPerWeek);
  const schedule = weeklyScheduleFor(split, input.trainingDaysPerWeek);
  const offsets = trainingDayOffsets(input.trainingDaysPerWeek);
  const focuses = buildBlockSequence(input.goal, input.blockFocusStyle, input.blockCount);

  const usable = input.availableExercises.filter((e) =>
    isExerciseAllowed(e, input.injuryAreas, input.experienceLevel)
  );

  const blocks: PlanBlockSpec[] = focuses.map((focus, blockIndex) => {
    const prescription = BLOCK_PRESCRIPTIONS[focus];
    const usedInBlock = new Set<string>();

    const days: PlanDay[] = schedule.map((template, dayIndex) => {
      const chosen = selectDayExercises(template, focus, usable, usedInBlock);
      chosen.forEach((c) => usedInBlock.add(c.id));
      return {
        dayIndex,
        dayOffset: offsets[dayIndex] ?? dayIndex,
        dayLabel: template.dayLabel,
        muscleGroups: template.muscleGroups,
        exercises: chosen.map((c, i) => ({
          exerciseId: c.id,
          name: c.name,
          muscleGroup: c.muscleGroup!,
          exerciseType: c.exerciseType!,
          orderIndex: i,
          setsLow: prescription.setsLow,
          setsHigh: prescription.setsHigh,
          repRangeLow: prescription.repRangeLow,
          repRangeHigh: prescription.repRangeHigh,
          restSecondsLow: prescription.restSecondsLow,
          restSecondsHigh: prescription.restSecondsHigh,
        })),
      };
    });

    return {
      orderIndex: blockIndex,
      focus,
      durationWeeks: input.blockDurationWeeks,
      hasDeloadWeek: blockHasDeloadWeek(input.deloadPreference, input.blockDurationWeeks),
      prescription,
      days,
    };
  });

  return {
    name: planName(input.goal, blocks.length),
    goal: input.goal,
    split,
    trainingDaysPerWeek: input.trainingDaysPerWeek,
    durationWeeks: input.blockDurationWeeks * input.blockCount,
    blocks,
  };
}

const GOAL_PLAN_NAME: Record<PrimaryGoal, string> = {
  build_muscle: "Muscle Building Plan",
  build_strength: "Strength Plan",
  lose_fat: "Lean Out Plan",
  stay_active: "Consistency Plan",
  other: "Training Plan",
};

function planName(goal: PrimaryGoal, blockCount: number): string {
  return `${GOAL_PLAN_NAME[goal]} · ${blockCount} block${blockCount === 1 ? "" : "s"}`;
}

/**
 * Where a user is inside their plan on a given date: which block, which week
 * of that block, and whether this is a planned deload week.
 */
export type PlanPosition = {
  blockIndex: number;
  weekInBlock: number; // 1-based
  totalWeekIndex: number; // 1-based across the whole plan
  isDeloadWeek: boolean;
  isComplete: boolean;
};

export function planPositionOn(
  plan: { blocks: Array<{ durationWeeks: number; hasDeloadWeek: boolean }> },
  startedAt: Date,
  asOf: Date
): PlanPosition {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  // Date.UTC over the *local* calendar date gives a DST-free day count —
  // differencing two local midnights loses an hour across spring-forward and
  // drifts the whole plan by a day.
  const startOfDay = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const elapsedWeeks = Math.floor((startOfDay(asOf) - startOfDay(startedAt)) / msPerWeek);
  const totalWeekIndex = Math.max(0, elapsedWeeks) + 1;

  let remaining = totalWeekIndex;
  for (let i = 0; i < plan.blocks.length; i++) {
    const block = plan.blocks[i];
    if (remaining <= block.durationWeeks) {
      return {
        blockIndex: i,
        weekInBlock: remaining,
        totalWeekIndex,
        isDeloadWeek: block.hasDeloadWeek && remaining === block.durationWeeks,
        isComplete: false,
      };
    }
    remaining -= block.durationWeeks;
  }

  const last = plan.blocks[plan.blocks.length - 1];
  return {
    blockIndex: plan.blocks.length - 1,
    weekInBlock: last?.durationWeeks ?? 0,
    totalWeekIndex,
    isDeloadWeek: false,
    isComplete: true,
  };
}
