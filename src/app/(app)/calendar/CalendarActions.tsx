"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, subMonths } from "date-fns";
import { CalendarClock, NotebookPen, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { cn } from "@/lib/utils";
import { getWorkoutTypes } from "@/app/workout/new/actions";
import { scheduleWorkout } from "./actions";

type WorkoutTypeOption = { id: string; name: string; category: string; colorKey: string };

/** "log" = record a past workout (full logging flow); "schedule" = plan a future one. */
type Mode = "log" | "schedule";

/**
 * The calendar's three top-level actions. Start workout jumps straight into
 * the live flow; the other two share a day-and-type dialog — scheduling ends
 * there, while logging continues into the real workout flow driven by the
 * chosen past day.
 */
export function CalendarActions() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [date, setDate] = useState("");
  const [types, setTypes] = useState<WorkoutTypeOption[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const today = format(new Date(), "yyyy-MM-dd");
  const monthAgo = format(subMonths(new Date(), 1), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  // Logging reaches from one month back through today; scheduling starts tomorrow.
  const dateMin = mode === "log" ? monthAgo : tomorrow;
  const dateMax = mode === "log" ? today : undefined;
  const dateInRange = date !== "" && date >= dateMin && (dateMax == null || date <= dateMax);

  async function openDialog(next: Mode) {
    setMode(next);
    setError(false);
    setDate(next === "log" ? today : tomorrow);
    if (types === null) {
      try {
        const result = await getWorkoutTypes();
        setTypes(result.map(({ id, name, category, colorKey }) => ({ id, name, category, colorKey })));
      } catch {
        setError(true);
      }
    }
  }

  async function choose(typeId: string) {
    if (!dateInRange) return;
    if (mode === "log") {
      setSaving(typeId);
      router.push(`/workout/new?type=${typeId}&date=${date}`);
      return;
    }
    setSaving(typeId);
    setError(false);
    try {
      // Pass the browser's today so a UTC server agrees on which days are
      // "future" (see earliestAllowedDate in actions.ts).
      await scheduleWorkout(typeId, date, today);
    } catch {
      setError(true);
      setSaving(null);
      return;
    }
    setSaving(null);
    setMode(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" className="gap-2" onClick={() => router.push("/workout/new")}>
        <Play className="h-4 w-4" /> Start workout
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-auto gap-2 whitespace-normal py-2.5"
          onClick={() => openDialog("log")}
        >
          <NotebookPen className="h-4 w-4" /> Log previous workout
        </Button>
        <Button
          variant="outline"
          className="h-auto gap-2 whitespace-normal py-2.5"
          onClick={() => openDialog("schedule")}
        >
          <CalendarClock className="h-4 w-4" /> Schedule future workout
        </Button>
      </div>

      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "log" ? "Log a previous workout" : "Schedule a workout"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label>{mode === "log" ? "Which day?" : "Which day? (future)"}</Label>
            <Input
              type="date"
              value={date}
              min={dateMin}
              max={dateMax}
              onChange={(e) => setDate(e.target.value)}
            />
            {mode === "log" ? (
              <p className="text-xs text-muted-foreground">
                You can log back to one month ago.
              </p>
            ) : null}
            {!dateInRange && date !== "" ? (
              <p className="text-xs font-medium text-foreground" role="alert">
                {mode === "log"
                  ? "Pick a day between one month ago and today."
                  : "Pick a day after today."}
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm font-medium text-foreground" role="alert">
              Something went wrong. Please try again.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label>Workout type</Label>
            {types === null && !error ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : null}
            {types ? (
              <div className="flex max-h-[40vh] flex-col gap-1.5 overflow-y-auto">
                {types.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    disabled={saving !== null || !dateInRange}
                    onClick={() => choose(t.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary/60 disabled:opacity-60",
                      saving === t.id && "opacity-60"
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">{t.name}</span>
                    <CategoryBadge colorKey={t.colorKey} label={t.category.toLowerCase()} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
