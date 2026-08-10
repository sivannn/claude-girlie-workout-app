"use client";

import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import type { CalendarEvent } from "./data";
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
  return (
    <Sheet open={day !== null} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{day ? format(day, "EEEE, MMMM d") : ""}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4 pb-6">
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
              {e.status === "MISSED" ? (
                <div className="mt-3">
                  <RescheduleDialog eventId={e.id} workoutTypeName={e.workoutTypeName} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
