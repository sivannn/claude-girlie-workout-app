"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Missed-workout reschedule: remove the missed event, create a new planned one at the chosen date. */
export async function rescheduleEvent(eventId: string, newDate: string) {
  const user = await getCurrentUser();
  const event = await prisma.workoutEvent.findFirstOrThrow({
    where: { id: eventId, userId: user.id, status: "MISSED" },
  });

  await prisma.$transaction([
    prisma.workoutEvent.delete({ where: { id: event.id } }),
    prisma.workoutEvent.create({
      data: {
        userId: user.id,
        workoutTypeId: event.workoutTypeId,
        scheduledDate: new Date(newDate),
        status: "PLANNED",
        createdBy: "USER",
      },
    }),
  ]);
}
