"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { ExerciseCard } from "./ExerciseCard";
import { toEditableExercise, parseNumberInput, type EditableExercise } from "./sessionState";
import { getExerciseOptions, previewExerciseProgression } from "./actions";
import type { WeightliftingSessionData } from "./types";

export function WeightliftingSession({
  session,
  onFinish,
  finishing,
}: {
  session: WeightliftingSessionData;
  onFinish: (exercises: EditableExercise[], removedExerciseIds: string[]) => void;
  finishing: boolean;
}) {
  const [exercises, setExercises] = useState<EditableExercise[]>(() =>
    session.exercises.map(toEditableExercise)
  );
  const [abExercise, setAbExercise] = useState<EditableExercise | null>(() =>
    session.abExercise ? toEditableExercise(session.abExercise) : null
  );
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [options, setOptions] = useState<
    Array<{ id: string; name: string; movementCategoryLabel: string }>
  >([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

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
            onAddSet={() => addSet(index)}
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

      <Button
        size="lg"
        disabled={finishing}
        onClick={() => {
          const keptIds = new Set(allExercises.map((e) => e.exerciseId));
          // Excludes anything removed-then-re-added in the same session — it
          // was ultimately kept, so it shouldn't count as an avoided exercise.
          const finalRemovedIds = removedIds.filter((id) => !keptIds.has(id));
          onFinish(allExercises, finalRemovedIds);
        }}
      >
        {finishing ? "Saving…" : "Finish Workout"}
      </Button>

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
