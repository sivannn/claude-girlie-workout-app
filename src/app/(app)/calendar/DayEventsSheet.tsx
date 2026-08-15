"use client";

import { format, isBefore, startOfDay } from "date-fns";
import { CalendarPlus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import type { CalendarEvent } from "./data";
import { RemoveEventButton } from "./RemoveEventButton";
import { RescheduleDialog } from "./RescheduleDialog";
import { WorkoutDetailView } from "./WorkoutDetailView";

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  MISSED: "Missed",
};

export function DayEventsSheet({
  day,
  events,
  onOpenChange,
}: {
  day: Date | null;
  events: CalendarEvent[];
  onOpenChange: (open: boolean) => void;
}) {
  const isPastDay = day != null && isBefore(startOfDay(day), startOfDay(new Date()));

  return (
    <Sheet open={day !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{day ? format(day, "EEEE, MMMM d") : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CalendarPlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm text-muted-foreground">
                {isPastDay ? "Nothing happened on this day." : "Nothing planned yet."}
              </p>
              <p className="text-xs text-muted-foreground">
                {isPastDay
                  ? "Use “Log previous workout” above the calendar to record one."
                  : "Use the buttons above the calendar to start or schedule a workout."}
              </p>
            </div>
          ) : null}

          {events.map((e) => (
            <div key={e.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <CategoryBadge colorKey={e.colorKey} label={e.workoutTypeName} status={e.status} />
                <span className="text-xs text-muted-foreground">{STATUS_LABEL[e.status]}</span>
              </div>
              {e.durationMinutes != null ? (
                <p className="mt-2 text-xs text-muted-foreground">{e.durationMinutes} min</p>
              ) : null}
              {e.summary ? <p className="mt-1 text-xs text-muted-foreground">{e.summary}</p> : null}
              {e.status === "COMPLETED" && e.workoutId ? (
                <WorkoutDetailView workoutId={e.workoutId} />
              ) : null}
              {e.status === "COMPLETED" ? (
                <div className="mt-3 flex gap-2">
                  <RemoveEventButton
                    eventId={e.id}
                    workoutId={e.workoutId}
                    workoutTypeName={e.workoutTypeName}
                    completed
                  />
                </div>
              ) : null}
              {e.status === "PLANNED" || e.status === "MISSED" ? (
                <div className="mt-3 flex gap-2">
                  <RescheduleDialog
                    eventId={e.id}
                    workoutTypeName={e.workoutTypeName}
                    status={e.status}
                  />
                  <RemoveEventButton
                    eventId={e.id}
                    workoutId={null}
                    workoutTypeName={e.workoutTypeName}
                    completed={false}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
