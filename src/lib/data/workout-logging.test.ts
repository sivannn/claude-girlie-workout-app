import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { recordCompletedEvent, resolveBackdate } from "./workout-logging";

// ---------------------------------------------------------------------------
// resolveBackdate — the server-side range check for "log a previous workout":
// today back to one month ago, inclusive, measured against the user's today.
// ---------------------------------------------------------------------------

describe("resolveBackdate", () => {
  // A fixed server moment: Aug 14 2026, mid-afternoon local time.
  const now = new Date(2026, 7, 14, 15, 30);

  it("accepts today", () => {
    expect(resolveBackdate("2026-08-14", "2026-08-14", now)).toEqual(new Date(2026, 7, 14));
  });

  it("accepts exactly one month ago (inclusive lower bound)", () => {
    expect(resolveBackdate("2026-07-14", "2026-08-14", now)).toEqual(new Date(2026, 6, 14));
  });

  it("rejects one day beyond a month ago", () => {
    expect(() => resolveBackdate("2026-07-13", "2026-08-14", now)).toThrow(/one month/);
  });

  it("rejects tomorrow and beyond", () => {
    expect(() => resolveBackdate("2026-08-15", "2026-08-14", now)).toThrow(/today or a past day/);
    expect(() => resolveBackdate("2026-09-01", "2026-08-14", now)).toThrow(/today or a past day/);
  });

  it("rejects malformed dates", () => {
    expect(() => resolveBackdate("not-a-date", "2026-08-14", now)).toThrow(/Invalid/);
  });

  it("trusts a client today that is one day ahead of the server (timezone skew)", () => {
    // Server still on Aug 14 (UTC), the user's evening is already Aug 15.
    expect(resolveBackdate("2026-08-15", "2026-08-15", now)).toEqual(new Date(2026, 7, 15));
  });

  it("ignores a forged client today far in the future", () => {
    // Claiming today is Sep 1 would widen the window; the claim is dropped
    // and the range is measured against the server's Aug 14.
    expect(() => resolveBackdate("2026-08-20", "2026-09-01", now)).toThrow(/today or a past day/);
  });

  it("ignores a forged client today far in the past", () => {
    // Claiming today is Jul 1 would allow backdating to June; dropped.
    expect(() => resolveBackdate("2026-06-15", "2026-07-01", now)).toThrow(/one month/);
  });

  it("falls back to the server clock when no client today is sent", () => {
    expect(resolveBackdate("2026-08-14", undefined, now)).toEqual(new Date(2026, 7, 14));
  });
});

// ---------------------------------------------------------------------------
// recordCompletedEvent — completing a workout on a day that already has a
// scheduled event of the same type completes that event; anything else gets
// its own COMPLETED entry. Runs against a throwaway copy of dev.db (schema
// donor only — all rows are wiped and rebuilt as fixtures).
// ---------------------------------------------------------------------------

const DEV_DB = path.join(process.cwd(), "prisma", "dev.db");
let tmpDir: string;
let prisma: PrismaClient;
let userId: string;
let legDayTypeId: string;
let cardioTypeId: string;

async function createWorkoutRow(date: Date, workoutTypeId = legDayTypeId): Promise<string> {
  const workout = await prisma.workout.create({
    data: { userId, workoutTypeId, date, durationMinutes: 45 },
  });
  return workout.id;
}

function eventsOn(date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return prisma.workoutEvent.findMany({
    where: { userId, scheduledDate: { gte: dayStart, lt: dayEnd } },
    orderBy: { createdAt: "asc" },
  });
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "steam-logging-test-"));
  const dbPath = path.join(tmpDir, "logging.db");
  fs.copyFileSync(DEV_DB, dbPath);
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbPath }) });
  await prisma.user.deleteMany();

  const user = await prisma.user.create({ data: { email: "owner@example.com", name: "Owner" } });
  userId = user.id;
  const legDay = await prisma.workoutType.create({
    data: { userId, name: "Leg Day", category: "WEIGHTLIFTING", colorKey: "glutes_legs" },
  });
  legDayTypeId = legDay.id;
  const cardio = await prisma.workoutType.create({
    data: { userId, name: "Running", category: "CARDIO", colorKey: "cardio" },
  });
  cardioTypeId = cardio.id;
});

afterAll(async () => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("recordCompletedEvent", () => {
  it("completes a same-type PLANNED event on that day instead of adding a second entry", async () => {
    const day = new Date(2026, 7, 3);
    const planned = await prisma.workoutEvent.create({
      data: { userId, workoutTypeId: legDayTypeId, scheduledDate: day, status: "PLANNED", createdBy: "AI" },
    });
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, { userId, workoutTypeId: legDayTypeId, workoutId, date: day });

    const events = await eventsOn(day);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(planned.id);
    expect(events[0].status).toBe("COMPLETED");
    expect(events[0].workoutId).toBe(workoutId);
  });

  it("completes a same-type MISSED event (a past plan the reconciler already marked)", async () => {
    const day = new Date(2026, 7, 4);
    const missed = await prisma.workoutEvent.create({
      data: { userId, workoutTypeId: legDayTypeId, scheduledDate: day, status: "MISSED", createdBy: "AI" },
    });
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, { userId, workoutTypeId: legDayTypeId, workoutId, date: day });

    const events = await eventsOn(day);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(missed.id);
    expect(events[0].status).toBe("COMPLETED");
    expect(events[0].workoutId).toBe(workoutId);
  });

  it("leaves a different-type scheduled event alone and creates its own entry", async () => {
    const day = new Date(2026, 7, 5);
    const plannedCardio = await prisma.workoutEvent.create({
      data: { userId, workoutTypeId: cardioTypeId, scheduledDate: day, status: "PLANNED", createdBy: "AI" },
    });
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, { userId, workoutTypeId: legDayTypeId, workoutId, date: day });

    const events = await eventsOn(day);
    expect(events).toHaveLength(2);
    const untouched = events.find((e) => e.id === plannedCardio.id);
    expect(untouched?.status).toBe("PLANNED");
    const completed = events.find((e) => e.id !== plannedCardio.id);
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.workoutTypeId).toBe(legDayTypeId);
    expect(completed?.workoutId).toBe(workoutId);
  });

  it("creates a fresh COMPLETED event when the day has nothing scheduled", async () => {
    const day = new Date(2026, 7, 6);
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, { userId, workoutTypeId: legDayTypeId, workoutId, date: day });

    const events = await eventsOn(day);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("COMPLETED");
    expect(events[0].createdBy).toBe("USER");
    expect(events[0].workoutId).toBe(workoutId);
  });

  it("does not match a same-type event scheduled on a neighboring day", async () => {
    const day = new Date(2026, 7, 8);
    const dayBefore = new Date(2026, 7, 7);
    const plannedYesterday = await prisma.workoutEvent.create({
      data: { userId, workoutTypeId: legDayTypeId, scheduledDate: dayBefore, status: "MISSED", createdBy: "AI" },
    });
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, { userId, workoutTypeId: legDayTypeId, workoutId, date: day });

    expect((await eventsOn(day)).map((e) => e.status)).toEqual(["COMPLETED"]);
    const yesterday = await prisma.workoutEvent.findUniqueOrThrow({ where: { id: plannedYesterday.id } });
    expect(yesterday.status).toBe("MISSED");
  });

  it("converts an IN_PROGRESS draft when draftEventId is given, even if a same-type plan exists", async () => {
    const day = new Date(2026, 7, 9);
    const planned = await prisma.workoutEvent.create({
      data: { userId, workoutTypeId: legDayTypeId, scheduledDate: day, status: "PLANNED", createdBy: "AI" },
    });
    const draft = await prisma.workoutEvent.create({
      data: {
        userId,
        workoutTypeId: legDayTypeId,
        scheduledDate: day,
        status: "IN_PROGRESS",
        createdBy: "USER",
        draftDataJson: "{}",
      },
    });
    const workoutId = await createWorkoutRow(day);

    await recordCompletedEvent(prisma, {
      userId,
      workoutTypeId: legDayTypeId,
      workoutId,
      date: day,
      draftEventId: draft.id,
    });

    const converted = await prisma.workoutEvent.findUniqueOrThrow({ where: { id: draft.id } });
    expect(converted.status).toBe("COMPLETED");
    expect(converted.workoutId).toBe(workoutId);
    expect(converted.draftDataJson).toBeNull();
    // The draft, not the plan, becomes the completed entry — existing behavior.
    const plan = await prisma.workoutEvent.findUniqueOrThrow({ where: { id: planned.id } });
    expect(plan.status).toBe("PLANNED");
  });
});
