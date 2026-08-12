"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setDailyCalorieTarget } from "@/app/(app)/calories/actions";

/**
 * The daily calorie goal lives on UserPreferences, not the Goal model — Goal
 * models one-shot start-to-target progressions, which a recurring daily
 * budget is not.
 */
export function DailyCalorieGoal({ initial }: { initial: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial != null ? String(initial) : "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  function save(next: number | null) {
    setStatus("idle");
    startTransition(async () => {
      try {
        await setDailyCalorieTarget(next);
        setStatus("saved");
        router.refresh();
      } catch {
        setStatus("error");
      }
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Daily Targets</h2>
      <div className="tile space-y-3 rounded-xl border p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Calories per day</p>
          <p className="text-xs text-muted-foreground">
            Drives the remaining-today bar on the Calories tab. Workouts you log credit back
            against it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={800}
            max={6000}
            step={50}
            placeholder="e.g. 2000"
            className="max-w-32"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">kcal</span>
          <Button
            size="sm"
            disabled={isPending}
            onClick={() => save(value ? Number(value) : null)}
          >
            {isPending ? "Saving…" : "Save"}
          </Button>
          {initial != null ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setValue("");
                save(null);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {status === "saved" ? (
          <p className="text-xs font-medium text-accent-text" role="status">
            Saved.
          </p>
        ) : null}
        {status === "error" ? (
          <p className="text-xs font-medium text-foreground" role="alert">
            Daily goal should be between 800 and 6,000 kcal.
          </p>
        ) : null}
      </div>
    </section>
  );
}
