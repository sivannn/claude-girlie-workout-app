"use client";

import { useState } from "react";
import { eachDayOfInterval, format, isSameDay, isToday } from "date-fns";
import { eventStatusStyle } from "@/lib/design/categories";
import { cn } from "@/lib/utils";
import type { WeeklyGoalBucket } from "@/lib/data/workout-types";
import type { CalendarEvent } from "./data";
import { DayEventsSheet } from "./DayEventsSheet";

const BUCKET_LABEL: Record<WeeklyGoalBucket, string> = {
  leg_day: "Leg Day",
  upper_body: "Upper Body",
  cardio: "Cardio",
  fun: "Fun Activity",
};

type WeeklyStatus = Record<
  WeeklyGoalBucket,
  { completed: boolean; completedDate: Date | null; lastCompletedDate: Date | null }
>;

export function WeekView({
  weekStart,
  weekEnd,
  events,
  weeklyStatus,
}: {
  weekStart: Date;
  weekEnd: Date;
  events: CalendarEvent[];
  weeklyStatus: WeeklyStatus;
}) {
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(e.date, day));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          const isSelected = selectedDay != null && isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border border-border/70 py-2 text-xs transition-colors",
                isToday(day) && "ring-1 ring-accent",
                isSelected && "border-transparent bg-foreground"
              )}
            >
              <span className={cn(isSelected ? "text-background/70" : "text-muted-foreground")}>
                {format(day, "EEE")}
              </span>
              <span className={cn("font-medium", isSelected ? "font-semibold text-background" : "text-foreground")}>
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayEvents.map((e) => {
                  const style = eventStatusStyle(e.colorKey, e.status);
                  return (
                    <span
                      key={e.id}
                      className="h-1.5 w-4 rounded-full"
                      style={{
                        backgroundColor: style.background === "transparent" ? "transparent" : style.background,
                        border: `1px solid ${style.border}`,
                        opacity: style.opacity ?? 1,
                      }}
                    />
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Weekly Goals</h2>
        <div className="flex flex-col gap-2">
          {(Object.keys(BUCKET_LABEL) as WeeklyGoalBucket[]).map((bucket) => {
            const status = weeklyStatus[bucket];
            return (
              <div
                key={bucket}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3",
                  status.completed ? "tile-dark" : "tile"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
                      status.completed
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-transparent"
                    )}
                  >
                    ✓
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{BUCKET_LABEL[bucket]}</p>
                    <p className="text-xs text-muted-foreground">
                      {status.completed && status.completedDate
                        ? `Completed ${format(status.completedDate, "MMM d")}`
                        : status.lastCompletedDate
                          ? `Last completed ${format(status.lastCompletedDate, "MMM d")}`
                          : "Not completed yet"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <DayEventsSheet
        day={selectedDay}
        events={selectedDay ? eventsForDay(selectedDay) : []}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      />
    </div>
  );
}
