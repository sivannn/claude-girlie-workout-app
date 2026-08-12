"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ExerciseCard } from "./ExerciseCard";
import { toEditableExercise, parseNumberInput, type EditableExercise } from "./sessionState";
import {
  discardDraftWorkout,
  getExerciseOptions,
  previewExerciseProgression,
  saveDraftWorkout,
} from "./actions";
import type { WeightliftingSessionData } from "./types";

export function WeightliftingSession({
  session,
  initialExercises,
  initialAbExercise,
  initialRemovedIds,
  draftEventId,
  onFinish,
  finishing,
}: {
  session: WeightliftingSessionData;
  initialExercises?: EditableExercise[];
  initialAbExercise?: EditableExercise | null;
  initialRemovedIds?: string[];
  draftEventId: string | null;
  onFinish: (exercises: EditableExercise[], removedExerciseIds: string[]) => void;
  finishing: boolean;
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState<EditableExercise[]>(
    () => initialExercises ?? session.exercises.map(toEditableExercise)
  );
  const [abExercise, setAbExercise] = useState<EditableExercise | null>(
    () => initialAbExercise ?? (session.abExercise ? toEditableExercise(session.abExercise) : null)
  );
  const [removedIds, setRemovedIds] = useState<string[]>(initialRemovedIds ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [options, setOptions] = useState<
    Array<{ id: string; name: string; movementCategoryLabel: string }>
  >([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [exiting, setExiting] = useState(false);

  const allExercises = abExercise ? [...exercises, abExercise] : exercises;

  const updateSet = (
    exerciseIndex: number,
    setIndex: number,
    field: "actualWeight" | "actualReps",
    value: string
  ) => {
    const parsed = parseNumberInput(value);
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex
          ? ex
          : { ...ex, sets: ex.sets.map((s, si) => (si !== setIndex ? s : { ...s, [field]: parsed })) }
      )
    );
  };

  /** Warm-up actuals, prefilled from the recommendation and editable like any set. */
  const updateWarmup = (exerciseIndex: number, field: "weight" | "reps", value: string) => {
    const parsed = parseNumberInput(value);
    setExercises((prev) =>
      prev.map((ex, i) =>
        i !== exerciseIndex ? ex : { ...ex, warmup: { ...ex.warmup, [field]: parsed } }
      )
    );
  };

  const updateAbWarmup = (field: "weight" | "reps", value: string) => {
    const parsed = parseNumberInput(value);
    setAbExercise((prev) => (prev ? { ...prev, warmup: { ...prev.warmup, [field]: parsed } } : prev));
  };

  const addSet = (exerciseIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;
        const last = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              setNumber: ex.sets.length + 1,
              recommendedWeight: last?.recommendedWeight ?? null,
              recommendedRepsLow: last?.recommendedRepsLow ?? 8,
              recommendedRepsHigh: last?.recommendedRepsHigh ?? 12,
              actualWeight: last?.recommendedWeight ?? null,
              actualReps: null,
            },
          ],
        };
      })
    );
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex || ex.sets.length <= 1) return ex;
        return {
          ...ex,
          sets: ex.sets
            .filter((_, si) => si !== setIndex)
            .map((s, si) => ({ ...s, setNumber: si + 1 })),
        };
      })
    );
  };

  const removeExercise = (exerciseId: string) => {
    setRemovedIds((prev) => [...prev, exerciseId]);
    setExercises((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  };

  const moveExercise = (index: number, direction: "up" | "down") => {
    setExercises((prev) => {
      const next = [...prev];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setLoadingOptions(true);
    const excludeIds = allExercises.map((e) => e.exerciseId);
    const results = await getExerciseOptions(session.colorKey, excludeIds);
    setOptions(results);
    setLoadingOptions(false);
  };

  const addExercise = async (exerciseId: string) => {
    setPickerOpen(false);
    const preview = await previewExerciseProgression(exerciseId);
    setExercises((prev) => [...prev, toEditableExercise(preview)]);
  };

  const finalRemovedIds = () => {
    const keptIds = new Set(allExercises.map((e) => e.exerciseId));
    // Excludes anything removed-then-re-added in the same session — it was
    // ultimately kept, so it shouldn't count as an avoided exercise.
    return removedIds.filter((id) => !keptIds.has(id));
  };

  // Weight fields start prefilled with the recommendation, so they're not a
  // reliable "did the user do anything" signal — reps are always blank until
  // actually logged, so that's what determines whether there's real progress.
  const hasProgress = allExercises.some((e) => e.sets.some((s) => s.actualReps != null));

  const handleExitClick = async () => {
    if (!hasProgress) {
      setExiting(true);
      if (draftEventId) await discardDraftWorkout(draftEventId);
      router.push("/");
      return;
    }
    setExitDialogOpen(true);
  };

  const handleSaveAndExit = async () => {
    setExiting(true);
    await saveDraftWorkout(
      {
        workoutTypeId: session.workoutTypeId,
        workoutTypeName: session.workoutTypeName,
        colorKey: session.colorKey,
        brief: session.brief,
        exercises,
        abExercise,
        removedExerciseIds: finalRemovedIds(),
      },
      draftEventId
    );
    router.push("/");
  };

  const handleDiscardExit = async () => {
    setExiting(true);
    if (draftEventId) await discardDraftWorkout(draftEventId);
    router.push("/");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <CategoryBadge colorKey={session.colorKey} label={session.workoutTypeName} />
      </div>

      <AlexNote title="Today's brief">{session.brief}</AlexNote>

      <div className="flex flex-col gap-4">
        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.exerciseId}
            exercise={exercise}
            canMoveUp={index > 0}
            canMoveDown={index < exercises.length - 1}
            onSetChange={(setIndex, field, value) => updateSet(index, setIndex, field, value)}
            onWarmupChange={(field, value) => updateWarmup(index, field, value)}
            onAddSet={() => addSet(index)}
            onRemoveSet={(setIndex) => removeSet(index, setIndex)}
            onRemove={() => removeExercise(exercise.exerciseId)}
            onMove={(direction) => moveExercise(index, direction)}
          />
        ))}

        {abExercise ? (
          <ExerciseCard
            exercise={abExercise}
            canMoveUp={false}
            canMoveDown={false}
            onSetChange={(setIndex, field, value) => {
              const parsed = parseNumberInput(value);
              setAbExercise((prev) =>
                prev
                  ? {
                      ...prev,
                      sets: prev.sets.map((s, si) => (si !== setIndex ? s : { ...s, [field]: parsed })),
                    }
                  : prev
              );
            }}
            onWarmupChange={(field, value) => updateAbWarmup(field, value)}
            onAddSet={() =>
              setAbExercise((prev) => {
                if (!prev) return prev;
                const last = prev.sets[prev.sets.length - 1];
                return {
                  ...prev,
                  sets: [
                    ...prev.sets,
                    {
                      setNumber: prev.sets.length + 1,
                      recommendedWeight: last?.recommendedWeight ?? null,
                      recommendedRepsLow: last?.recommendedRepsLow ?? 12,
                      recommendedRepsHigh: last?.recommendedRepsHigh ?? 20,
                      actualWeight: last?.recommendedWeight ?? null,
                      actualReps: null,
                    },
                  ],
                };
              })
            }
            onRemoveSet={(setIndex) =>
              setAbExercise((prev) => {
                if (!prev || prev.sets.length <= 1) return prev;
                return {
                  ...prev,
                  sets: prev.sets
                    .filter((_, si) => si !== setIndex)
                    .map((s, si) => ({ ...s, setNumber: si + 1 })),
                };
              })
            }
            onRemove={() => {
              if (abExercise) setRemovedIds((prev) => [...prev, abExercise.exerciseId]);
              setAbExercise(null);
            }}
            onMove={() => {}}
          />
        ) : null}
      </div>

      <Button variant="outline" className="gap-1.5" onClick={openPicker}>
        <Plus className="h-4 w-4" /> Add exercise
      </Button>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={finishing || exiting}
          onClick={handleExitClick}
        >
          Exit
        </Button>
        <Button
          size="lg"
          className="flex-[2]"
          disabled={finishing || exiting}
          onClick={() => onFinish(allExercises, finalRemovedIds())}
        >
          {finishing ? "Saving…" : "Finish Workout"}
        </Button>
      </div>

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your progress?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            You can pick up right where you left off later, or discard this workout entirely.
          </p>
          <DialogFooter>
            <Button variant="ghost" disabled={exiting} onClick={handleDiscardExit}>
              Discard
            </Button>
            <Button disabled={exiting} onClick={handleSaveAndExit}>
              Save & Exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Add an exercise</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-4 pb-6">
            {loadingOptions ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : options.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No other exercises available.
              </p>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => addExercise(opt.id)}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                >
                  <span className="text-sm font-medium text-foreground">{opt.name}</span>
                  <span className="text-xs text-muted-foreground">{opt.movementCategoryLabel}</span>
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
