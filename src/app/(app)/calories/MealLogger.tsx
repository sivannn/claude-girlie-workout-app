"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Camera, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { analyzeMeal, deleteMeal, logMeal } from "./actions";
import type { LoggedMeal } from "./data";

type Draft = {
  name: string;
  calories: string;
  source: "photo" | "manual";
  note: string | null;
  confidence: "high" | "medium" | "low" | null;
};

const FAILURE_COPY: Record<string, string> = {
  unsupported: "That file type isn't supported — try a JPEG, PNG, or WebP photo.",
  too_large: "That photo is over 5MB. Try a smaller one.",
  unavailable:
    "Alex couldn't read that photo. You can still add the meal yourself below.",
};

export function MealLogger({ meals }: { meals: LoggedMeal[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError(null);
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const result = await analyzeMeal(formData);
      if (result.ok) {
        setDraft({
          name: result.analysis.name,
          calories: String(result.analysis.calories),
          source: "photo",
          note: result.analysis.note,
          confidence: result.analysis.confidence,
        });
      } else {
        setError(FAILURE_COPY[result.reason] ?? FAILURE_COPY.unavailable);
        // Still open the form so the failure isn't a dead end.
        setDraft({ name: "", calories: "", source: "manual", note: null, confidence: null });
      }
    } catch {
      setError(FAILURE_COPY.unavailable);
      setDraft({ name: "", calories: "", source: "manual", note: null, confidence: null });
    } finally {
      setAnalyzing(false);
    }
  }

  function save() {
    if (!draft) return;
    const calories = Number(draft.calories);
    if (!draft.name.trim()) {
      setError("Give the meal a name.");
      return;
    }
    if (!Number.isFinite(calories) || calories < 0 || calories > 10000) {
      setError("Calories should be between 0 and 10,000.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await logMeal({
          name: draft.name,
          calories,
          dateInput: format(new Date(), "yyyy-MM-dd"),
          source: draft.source,
        });
        setDraft(null);
        router.refresh();
      } catch {
        setError("Couldn't save that. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={onPhotoChosen}
        className="hidden"
      />

      {!draft ? (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            className="w-full text-base"
            disabled={analyzing}
            onClick={() => fileInput.current?.click()}
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Alex is looking…
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" /> Snap a meal
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setDraft({ name: "", calories: "", source: "manual", note: null, confidence: null })
            }
          >
            <Pencil className="mr-2 h-3.5 w-3.5" /> Add one manually
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-foreground" role="alert">
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className="tile flex flex-col gap-3 rounded-xl border p-4">
          {draft.source === "photo" ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent-text">
                Alex&apos;s estimate
                {draft.confidence && draft.confidence !== "high"
                  ? ` · ${draft.confidence} confidence`
                  : ""}
              </p>
              {draft.note ? <p className="text-xs text-muted-foreground">{draft.note}</p> : null}
              <p className="text-xs text-muted-foreground">
                Adjust anything that looks off before saving.
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="meal-name">Meal</Label>
            <Input
              id="meal-name"
              value={draft.name}
              placeholder="e.g. Chicken burrito bowl"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="meal-calories">Calories</Label>
            <div className="flex items-center gap-2">
              <Input
                id="meal-calories"
                type="number"
                inputMode="numeric"
                min={0}
                max={10000}
                className="max-w-32"
                value={draft.calories}
                onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
              />
              <span className="text-sm text-muted-foreground">kcal</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={isPending} className="flex-1">
              {isPending ? "Saving…" : "Log it"}
            </Button>
            <Button
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {meals.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Today&apos;s meals</h2>
          <div className="flex flex-col gap-2">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="tile flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{meal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {meal.calories} kcal
                    {meal.source === "photo" ? " · from a photo" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${meal.name}`}
                  className={cn(
                    "shrink-0 rounded-md p-2 text-muted-foreground transition-colors",
                    "hover:bg-secondary hover:text-foreground"
                  )}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteMeal(meal.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
