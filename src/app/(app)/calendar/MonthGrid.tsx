"use client";

import { useMemo, useState } from "react";
import { addDays, eachDayOfInterval, format, isSameDay, isSameMonth, isToday } from "date-fns";
import { eventStatusStyle } from "@/lib/design/categories";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "./data";
import { DayEventsSheet } from "./DayEventsSheet";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({
  gridStart,
  gridEnd,
  events,
  monthDate,
}: {
  gridStart: Date;
  gridEnd: Date;
  events: CalendarEvent[];
  monthDate: Date;
}) {
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: addDays(gridEnd, 0) }), [gridStart, gridEnd]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const eventsForDay = (day: Date) => events.filter((e) => isSameDay(e.date, day));

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayEvents = eventsForDay(day);
          // Completed wins over scheduled when a day has both; MISSED
          // deliberately falls through to a plain tile with no outline.
          const hasCompleted = dayEvents.some((e) => e.status === "COMPLETED" || e.status === "IN_PROGRESS");
          const hasPlanned = dayEvents.some((e) => e.status === "PLANNED");
          const isSelected = selectedDay != null && isSameDay(day, selectedDay);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={cn(
                // Every day is a filled brown tile lifted off the page;
                // today is lighter still, status shows as an outline color,
                // and selected flips to a light background with dark text.
                "flex aspect-square flex-col items-center justify-start gap-0.5 rounded-lg border-2 border-transparent bg-day-tile p-1 text-xs transition-colors",
                !isSameMonth(day, monthDate) && !isSelected && "opacity-30",
                isToday(day) && "bg-day-tile-today",
                hasCompleted ? "border-day-outline-done" : hasPlanned && "border-day-outline-planned",
                isSelected && "border-transparent bg-foreground"
              )}
            >
              <span className={cn(isSelected ? "font-semibold text-background" : "text-foreground")}>
                {format(day, "d")}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5">
                {dayEvents.slice(0, 4).map((e) => {
                  const style = eventStatusStyle(e.colorKey, e.status);
                  return (
                    <span
                      key={e.id}
                      className="h-1.5 w-1.5 rounded-full"
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

      <DayEventsSheet
        day={selectedDay}
        events={selectedDay ? eventsForDay(selectedDay) : []}
        onOpenChange={(open) => !open && setSelectedDay(null)}
      />
    </div>
  );
}
