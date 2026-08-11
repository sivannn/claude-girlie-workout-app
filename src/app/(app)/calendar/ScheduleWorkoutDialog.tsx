"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, isBefore, startOfDay } from "date-fns";
import { Plus } from "lucide-react";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getWorkoutTypes } from "@/app/workout/new/actions";
import { scheduleWorkout } from "./actions";

type WorkoutTypeOption = { id: string; name: string; category: string; colorKey: string };

/**
 * The light-green "Schedule workout" plus in the calendar day sheet —
 * deliberately distinct from the red plus, which always means "work out
 * right now". Picks a workout type, then creates a planned event on `day`.
 */
export function ScheduleWorkoutDialog({ day }: { day: Date }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<WorkoutTypeOption[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const isPast = isBefore(startOfDay(day), startOfDay(new Date()));

  async function onOpenChange(next: boolean) {
    setOpen(next);
    setError(false);
    if (next && types === null) {
      try {
        const result = await getWorkoutTypes();
        setTypes(result.map(({ id, name, category, colorKey }) => ({ id, name, category, colorKey })));
      } catch {
        setError(true);
      }
    }
  }

  async function schedule(typeId: string) {
    setSaving(typeId);
    setError(false);
    try {
      // Pass the browser's today so a UTC server doesn't reject the day this
      // very dialog just offered (see earliestAllowedDate in actions.ts).
      await scheduleWorkout(typeId, format(day, "yyyy-MM-dd"), format(new Date(), "yyyy-MM-dd"));
    } catch {
      setError(true);
      setSaving(null);
      return;
    }
    setSaving(null);
    setOpen(false);
    router.refresh();
  }

  if (isPast) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-200 px-3 py-2.5 text-sm font-medium text-green-950 transition-colors hover:bg-green-300"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-950/90 text-green-100">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          Schedule workout
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule for {format(day, "EEEE, MMMM d")}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Something went wrong. Please try again.
          </p>
        ) : null}
        {types === null && !error ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {types ? (
          <div className="flex flex-col gap-1.5">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={saving !== null}
                onClick={() => schedule(t.id)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-secondary/60",
                  saving === t.id && "opacity-60"
                )}
              >
                <span className="text-sm font-medium text-foreground">{t.name}</span>
                <CategoryBadge colorKey={t.colorKey} label={t.category.toLowerCase()} />
              </button>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
