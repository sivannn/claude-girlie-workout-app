import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { deleteCompletedWorkout } from "./workout-removal";

// Runs against a throwaway copy of dev.db (schema donor only — all rows are
// wiped and rebuilt as fixtures).

const DEV_DB = path.join(process.cwd(), "prisma", "dev.db");
let tmpDir: string;
let prisma: PrismaClient;
let userId: string;
let otherUserId: string;
let squatId: string;

async function createWorkout(opts: {
  ownerId?: string;
  date: Date;
  weights: number[];
  withEvent?: boolean;
}): Promise<string> {
  const ownerId = opts.ownerId ?? userId;
  const type = await prisma.workoutType.findFirstOrThrow({ where: { userId: ownerId } });
  const workout = await prisma.workout.create({
    data: {
      userId: ownerId,
      workoutTypeId: type.id,
      date: opts.date,
      durationMinutes: 45,
      ...(opts.weights.length > 0
        ? {
            exercises: {
              create: [
                {
                  exerciseId: squatId,
                  orderIndex: 0,
                  movementCategory: "squat_lunge",
                  sets: {
                    create: opts.weights.map((w, i) => ({
                      setNumber: i + 1,
                      actualWeight: w,
                      actualReps: 8,
                    })),
                  },
                },
              ],
            },
          }
        : {}),
    },
  });
  if (opts.withEvent !== false) {
    await prisma.workoutEvent.create({
      data: {
        userId: ownerId,
        workoutTypeId: type.id,
        scheduledDate: opts.date,
        status: "COMPLETED",
        createdBy: "USER",
        workoutId: workout.id,
      },
    });
  }
  return workout.id;
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-removal-test-"));
  const dbPath = path.join(tmpDir, "removal.db");
  fs.copyFileSync(DEV_DB, dbPath);
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbPath }) });
  await prisma.user.deleteMany();

  const user = await prisma.user.create({ data: { email: "owner@example.com", name: "Owner" } });
  userId = user.id;
  const other = await prisma.user.create({ data: { email: "other@example.com", name: "Other" } });
  otherUserId = other.id;
  for (const id of [userId, otherUserId]) {
    await prisma.workoutType.create({
      data: { userId: id, name: "Leg Day", category: "WEIGHTLIFTING", colorKey: "glutes_legs" },
    });
  }
  const squat = await prisma.exercise.create({
    data: {
      userId,
      name: "Barbell Squat",
      workoutCategory: "glutes_legs",
      movementCategory: "squat_lunge",
      kind: "STRENGTH",
    },
  });
  squatId = squat.id;
});

afterAll(async () => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("deleteCompletedWorkout", () => {
  it("deletes the workout, its sets, its event, and its PR achievements — and recomputes goals", async () => {
    const older = await createWorkout({ date: new Date("2026-08-01T10:00:00Z"), weights: [95, 100] });
    const newer = await createWorkout({ date: new Date("2026-08-08T10:00:00Z"), weights: [105, 110] });
    await prisma.achievement.create({
      data: { userId, type: "PR", title: "Barbell Squat: new best of 100 lb", relatedWorkoutId: older },
    });
    await prisma.achievement.create({
      data: { userId, type: "PR", title: "Barbell Squat: new best of 110 lb", relatedWorkoutId: newer },
    });
    // Goal completed by the newer workout: target 108, milestones at 105/108.
    const goal = await prisma.goal.create({
      data: {
        userId,
        exerciseId: squatId,
        category: "glutes_legs",
        title: "Barbell Squat",
        unit: "lb",
        startingValue: 95,
        currentBest: 110,
        targetValue: 108,
        status: "COMPLETED",
        completedAt: new Date("2026-08-08T11:00:00Z"),
        milestones: {
          create: [
            { value: 105, order: 1, achievedAt: new Date("2026-08-08T11:00:00Z") },
            { value: 108, order: 2, achievedAt: new Date("2026-08-08T11:00:00Z") },
          ],
        },
      },
    });
    await prisma.achievement.create({
      data: { userId, type: "GOAL_COMPLETED", title: "Goal reached", relatedGoalId: goal.id },
    });

    const removed = await deleteCompletedWorkout(prisma, userId, newer);
    expect(removed).toBe(true);

    // Workout graph gone.
    expect(await prisma.workout.findUnique({ where: { id: newer } })).toBeNull();
    expect(await prisma.workoutSet.count({ where: { workoutExercise: { workoutId: newer } } })).toBe(0);
    expect(await prisma.workoutEvent.count({ where: { workoutId: newer } })).toBe(0);
    // Only the deleted workout's PR achievement is removed; the older one stays.
    const prs = await prisma.achievement.findMany({ where: { userId, type: "PR" } });
    expect(prs).toHaveLength(1);
    expect(prs[0].relatedWorkoutId).toBe(older);
    // Goal recomputed from remaining history: best is 100 again.
    const after = await prisma.goal.findUniqueOrThrow({
      where: { id: goal.id },
      include: { milestones: { orderBy: { order: "asc" } } },
    });
    expect(after.currentBest).toBe(100);
    expect(after.status).toBe("ACTIVE");
    expect(after.completedAt).toBeNull();
    // Both milestones (105, 108) are above the new best — un-achieved.
    expect(after.milestones.every((m) => m.achievedAt === null)).toBe(true);
    // The goal-completed achievement is gone.
    expect(await prisma.achievement.count({ where: { userId, type: "GOAL_COMPLETED" } })).toBe(0);
    // The older workout is fully intact.
    expect(await prisma.workout.findUnique({ where: { id: older } })).not.toBeNull();
  });

  it("keeps a still-satisfied goal completed and still recomputes its best", async () => {
    // Self-contained: this test creates the history its premise depends on.
    await createWorkout({ date: new Date("2026-08-02T10:00:00Z"), weights: [100] });
    // currentBest is deliberately stale (99) so the assertion below only
    // passes if the recompute actually ran — target 98 keeps it COMPLETED.
    const goal = await prisma.goal.create({
      data: {
        userId,
        exerciseId: squatId,
        category: "glutes_legs",
        title: "Barbell Squat modest",
        unit: "lb",
        startingValue: 95,
        currentBest: 99,
        targetValue: 98,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    const extra = await createWorkout({ date: new Date("2026-08-09T10:00:00Z"), weights: [99] });
    await deleteCompletedWorkout(prisma, userId, extra);
    const after = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.currentBest).toBe(100);
  });

  it("refuses to delete another user's workout", async () => {
    const foreign = await createWorkout({
      ownerId: otherUserId,
      date: new Date("2026-08-05T10:00:00Z"),
      weights: [],
      withEvent: false,
    });
    const removed = await deleteCompletedWorkout(prisma, userId, foreign);
    expect(removed).toBe(false);
    expect(await prisma.workout.findUnique({ where: { id: foreign } })).not.toBeNull();
  });
});
