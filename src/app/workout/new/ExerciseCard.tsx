"use client";

import { useState } from "react";
import { Trash2, ChevronUp, ChevronDown, Plus, X, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getExerciseInstructions } from "./actions";
import type { EditableExercise } from "./sessionState";

export function ExerciseCard({
  exercise,
  canMoveUp,
  canMoveDown,
  onSetChange,
  onWarmupChange,
  onAddSet,
  onRemoveSet,
  onRemove,
  onMove,
}: {
  exercise: EditableExercise;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onSetChange: (setIndex: number, field: "actualWeight" | "actualReps", value: string) => void;
  onWarmupChange: (field: "weight" | "reps", value: string) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoText, setInfoText] = useState<string | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);

  const openInfo = async () => {
    setInfoOpen(true);
    if (infoText) return;
    setInfoLoading(true);
    const text = await getExerciseInstructions(exercise.exerciseId);
    setInfoText(text);
    setInfoLoading(false);
  };

  return (
    <div className="tile rounded-xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{exercise.name}</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground"
              onClick={openInfo}
              aria-label={`How to perform ${exercise.name}`}
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
            <Badge variant="secondary" className="text-[11px] font-normal">
              {exercise.movementCategoryLabel}
            </Badge>
            {exercise.isDeload ? (
              <Badge className="bg-accent text-[11px] font-normal text-accent-foreground">
                Deload
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{exercise.selectionReason}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveUp}
            onClick={() => onMove("up")}
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!canMoveDown}
            onClick={() => onMove("down")}
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label="Remove exercise"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {exercise.progressionReason}
      </p>

      {exercise.coachAdjustment ? (
        <p className="mt-2 rounded-md bg-accent/10 px-2.5 py-1.5 text-xs leading-relaxed text-accent-text">
          <span className="font-semibold">Alex adjusted this:</span> {exercise.coachAdjustment}
        </p>
      ) : null}

      {(exercise.lastWorkoutSummary || exercise.longTermGoal) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {exercise.lastWorkoutSummary ? <span>Last time: {exercise.lastWorkoutSummary}</span> : null}
          {exercise.longTermGoal ? <span>Goal: {exercise.longTermGoal}</span> : null}
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1.75rem] gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Set</span>
          <span>Recommended</span>
          <span>Weight</span>
          <span>Reps</span>
          <span />
        </div>

        {/* The warmup is a real, editable row — it's logged like any other
            set. It stays out of progression math because it's stored on the
            exercise, not as a WorkoutSet. */}
        {exercise.warmup.weight != null && (
          <div className="grid grid-cols-[2rem_1fr_1fr_1fr_1.75rem] items-center gap-2">
            <span className="text-[11px] font-medium uppercase text-muted-foreground">W</span>
            <span className="text-sm text-muted-foreground">Warm-up</span>
            <Input
              type="number"
              inputMode="decimal"
              value={exercise.warmup.weight ?? ""}
              placeholder="lb"
              onChange={(e) => onWarmupChange("weight", e.target.value)}
              className="h-9"
              aria-label="Warm-up weight"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={exercise.warmup.reps ?? ""}
              placeholder="reps"
              onChange={(e) => onWarmupChange("reps", e.target.value)}
              className="h-9"
              aria-label="Warm-up reps"
            />
            <span />
          </div>
        )}
        {exercise.sets.map((set, i) => (
          <div key={set.setNumber} className="grid grid-cols-[2rem_1fr_1fr_1fr_1.75rem] items-center gap-2">
            <span className="text-sm text-muted-foreground">{set.setNumber}</span>
            <span className="text-sm text-muted-foreground">
              {set.recommendedWeight != null ? `${set.recommendedWeight} lb` : "—"} ×{" "}
              {set.recommendedRepsLow}–{set.recommendedRepsHigh}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              value={set.actualWeight ?? ""}
              placeholder={set.recommendedWeight != null ? String(set.recommendedWeight) : "lb"}
              onChange={(e) => onSetChange(i, "actualWeight", e.target.value)}
              className="h-9"
            />
            <Input
              type="number"
              inputMode="numeric"
              value={set.actualReps ?? ""}
              placeholder="reps"
              onChange={(e) => onSetChange(i, "actualReps", e.target.value)}
              className="h-9"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-0"
              disabled={exercise.sets.length <= 1}
              onClick={() => onRemoveSet(i)}
              aria-label="Remove set"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs" onClick={onAddSet}>
        <Plus className="h-3.5 w-3.5" /> Add set
      </Button>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How to: {exercise.name}</DialogTitle>
          </DialogHeader>
          {infoLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{infoText}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
