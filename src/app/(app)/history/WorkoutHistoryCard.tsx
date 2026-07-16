"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { AlexNote } from "@/components/shared/AlexNote";
import { cn } from "@/lib/utils";
import type { WorkoutListItem } from "./data";

export function WorkoutHistoryCard({ workout }: { workout: WorkoutListItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="tile rounded-xl border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-col gap-2 p-4 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CategoryBadge colorKey={workout.colorKey} label={workout.workoutTypeName} />
            {workout.hasPR ? (
              <span className="text-xs font-medium text-accent">+ PR achieved</span>
            ) : null}
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{format(workout.date, "MMMM d, yyyy")}</span>
          <span>{workout.durationMinutes} min</span>
          {workout.exerciseCount > 0 ? <span>{workout.exerciseCount} exercises</span> : null}
        </div>
        {workout.summary ? (
          <p className="text-sm text-muted-foreground line-clamp-2">{workout.summary}</p>
        ) : null}
      </button>

      {expanded ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {workout.summary ? <AlexNote title="Workout Summary">{workout.summary}</AlexNote> : null}

          {workout.cardioDistanceMiles != null || workout.cardioTimeSeconds != null ? (
            <div className="flex gap-4 text-sm text-foreground">
              {workout.cardioDistanceMiles != null ? <span>{workout.cardioDistanceMiles} mi</span> : null}
              {workout.cardioTimeSeconds != null ? (
                <span>{Math.round(workout.cardioTimeSeconds / 60)} min</span>
              ) : null}
              {workout.cardioIndoorOutdoor ? (
                <span className="capitalize">{workout.cardioIndoorOutdoor}</span>
              ) : null}
            </div>
          ) : null}

          {workout.notes ? <p className="text-sm text-muted-foreground">{workout.notes}</p> : null}

          {workout.exercises.map((ex) => (
            <div key={ex.exerciseId} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-foreground">{ex.name}</h4>
                <span className="text-xs text-muted-foreground">{ex.movementCategoryLabel}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{ex.changeSummary}</p>

              <div className="mt-2 space-y-1">
                {ex.sets.map((s) => (
                  <div key={s.setNumber} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Set {s.setNumber}</span>
                    <span className="text-foreground">
                      {s.actualWeight != null ? `${s.actualWeight} lb × ${s.actualReps ?? "—"}` : "—"}
                      {s.recommendedWeight != null ? (
                        <span className="ml-1.5 text-muted-foreground">
                          (recommended {s.recommendedWeight} × {s.recommendedRepsLow}–{s.recommendedRepsHigh})
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
