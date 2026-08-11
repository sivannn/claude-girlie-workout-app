"use client";

import { useState } from "react";
import { ChevronDown, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorkoutDetail, type WorkoutDetail } from "./actions";

function formatCardioTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes} min`;
}

/**
 * Lazy-loaded set-by-set journal view for a completed workout, shown inside
 * the calendar day sheet — the detail that used to live on the History page.
 */
export function WorkoutDetailView({ workoutId }: { workoutId: string }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "error">("idle");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && state === "idle") {
      setState("loading");
      try {
        const result = await getWorkoutDetail(workoutId);
        setDetail(result);
        setState(result ? "loaded" : "error");
      } catch {
        setState("error");
      }
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1.5 text-xs font-medium text-accent-text"
        aria-expanded={open}
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide details" : "View details"}
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-3">
          {state === "loading" ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}
          {state === "error" ? (
            <p className="text-xs text-muted-foreground">Couldn&apos;t load this workout&apos;s details.</p>
          ) : null}
          {state === "loaded" && detail ? (
            <>
              {detail.hasPR ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-accent-text">
                  <Trophy className="h-3.5 w-3.5" /> Personal record set in this workout
                </p>
              ) : null}

              {detail.cardioTimeSeconds != null || detail.cardioDistanceMiles != null ? (
                <p className="text-xs text-muted-foreground">
                  {[
                    detail.cardioDistanceMiles != null ? `${detail.cardioDistanceMiles} mi` : null,
                    detail.cardioTimeSeconds != null ? formatCardioTime(detail.cardioTimeSeconds) : null,
                    detail.cardioIndoorOutdoor,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}

              {detail.exercises.map((ex) => (
                <div key={ex.name} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{ex.name}</p>
                    <p className="text-[10px] text-muted-foreground">{ex.movementCategoryLabel}</p>
                  </div>
                  {ex.changeSummary ? (
                    <p
                      className={cn(
                        "mt-0.5 text-[11px]",
                        ex.improved ? "font-medium text-accent-text" : "text-muted-foreground"
                      )}
                    >
                      {ex.changeSummary}
                    </p>
                  ) : null}
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="py-0.5 pr-3 font-medium">Set</th>
                          <th className="py-0.5 pr-3 font-medium">Weight</th>
                          <th className="py-0.5 pr-3 font-medium">Reps</th>
                          <th className="py-0.5 font-medium">Suggested</th>
                        </tr>
                      </thead>
                      <tbody className="text-foreground">
                        {ex.sets.map((s) => (
                          <tr key={s.setNumber}>
                            <td className="py-0.5 pr-3 tabular-nums">{s.setNumber}</td>
                            <td className="py-0.5 pr-3 tabular-nums">
                              {s.actualWeight != null ? `${s.actualWeight} lb` : "—"}
                            </td>
                            <td className="py-0.5 pr-3 tabular-nums">{s.actualReps ?? "—"}</td>
                            <td className="py-0.5 tabular-nums text-muted-foreground">
                              {s.recommendedWeight != null
                                ? `${s.recommendedWeight} lb × ${s.recommendedRepsLow ?? "?"}–${s.recommendedRepsHigh ?? "?"}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {detail.notes ? (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Notes:</span> {detail.notes}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
