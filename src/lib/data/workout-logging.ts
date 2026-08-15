import { subMonths } from "date-fns";
import type { PrismaClient } from "@/generated/prisma/client";
import { parseLocalDateInput } from "@/lib/utils/date";

/**
 * Resolves "today" from the client's claimed local date, trusting it only
 * within a day of the server's clock. Deployed servers run in UTC while the
 * calendar UI is built from the browser's clock, so a Pacific evening is
 * already tomorrow on the server — but a forged value still can't move
 * "today" arbitrarily. Same policy as scheduling (calendar/actions.ts).
 */
export function resolveClientToday(clientToday: string | undefined, now = new Date()): Date {
  const serverToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!clientToday) return serverToday;
  const claimed = parseLocalDateInput(clientToday);
  if (Number.isNaN(claimed.getTime())) return serverToday;
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.abs(claimed.getTime() - serverToday.getTime()) <= dayMs ? claimed : serverToday;
}

/**
 * Validates and resolves the date a backdated workout is being logged for.
 * The allowed range is today back to one month ago, inclusive — enforced
 * here so the server never trusts the client's date picker.
 */
export function resolveBackdate(
  targetDate: string,
  clientToday: string | undefined,
  now = new Date()
): Date {
  const date = parseLocalDateInput(targetDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }
  const today = resolveClientToday(clientToday, now);
  if (date > today) {
    throw new Error("Workouts can only be logged for today or a past day.");
  }
  if (date < subMonths(today, 1)) {
    throw new Error("Workouts can only be logged up to one month back.");
  }
  return date;
}

/**
 * Records the calendar event for a workout that just completed.
 *
 * If the day already has a scheduled event of the same workout type —
 * PLANNED, or already auto-marked MISSED for a past day — completing a
 * workout of that type completes *that* event instead of adding a second
 * calendar entry. A different type leaves the scheduled event alone and
 * creates its own entry.
 *
 * `draftEventId` (live "save & exit" drafts) takes precedence: the
 * IN_PROGRESS row is converted rather than left behind.
 *
 * Lives outside the server-action file so the matching rule is
 * unit-testable against a throwaway database (see workout-logging.test.ts).
 */
export async function recordCompletedEvent(
  prisma: PrismaClient,
  params: {
    userId: string;
    workoutTypeId: string;
    workoutId: string;
    date: Date;
    draftEventId?: string | null;
  }
): Promise<void> {
  const { userId, workoutTypeId, workoutId, date, draftEventId } = params;

  if (draftEventId) {
    // Convert the in-progress draft event into the completed one, rather than
    // leaving a stale IN_PROGRESS row behind alongside a new COMPLETED one.
    await prisma.workoutEvent.update({
      where: { id: draftEventId, userId },
      data: { workoutTypeId, workoutId, scheduledDate: date, status: "COMPLETED", draftDataJson: null },
    });
    return;
  }

  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  const scheduled = await prisma.workoutEvent.findFirst({
    where: {
      userId,
      workoutTypeId,
      status: { in: ["PLANNED", "MISSED"] },
      scheduledDate: { gte: dayStart, lt: dayEnd },
    },
    orderBy: { createdAt: "asc" },
  });

  if (scheduled) {
    await prisma.workoutEvent.update({
      where: { id: scheduled.id },
      data: { workoutId, scheduledDate: date, status: "COMPLETED" },
    });
    return;
  }

  await prisma.workoutEvent.create({
    data: {
      userId,
      workoutTypeId,
      workoutId,
      scheduledDate: date,
      status: "COMPLETED",
      createdBy: "USER",
    },
  });
}
