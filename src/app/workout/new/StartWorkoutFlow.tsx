"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkoutCategory } from "@/lib/types/enums";
import { WorkoutTypeSelector, type WorkoutTypeOption } from "./WorkoutTypeSelector";
import { WeightliftingSession } from "./WeightliftingSession";
import { CardioSessionForm, type CardioResult } from "./CardioSessionForm";
import { SimpleSessionForm } from "./SimpleSessionForm";
import { RecapScreen } from "./RecapScreen";
import { completeWorkout, createCustomWorkoutType, generateWorkoutForType } from "./actions";
import type { EditableExercise } from "./sessionState";
import type { GeneratedSessionData } from "./types";

type Phase = "select" | "loading" | "session" | "finishing" | "recap";

export function StartWorkoutFlow({
  workoutTypes,
  initialTypeId,
}: {
  workoutTypes: WorkoutTypeOption[];
  initialTypeId: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(initialTypeId ? "loading" : "select");
  const [session, setSession] = useState<GeneratedSessionData | null>(null);
  const [recap, setRecap] = useState<{ text: string; prs: string[] } | null>(null);
  const startedAt = useRef<number>(0);
  const initialized = useRef(false);

  const selectType = useCallback(async (typeId: string) => {
    setPhase("loading");
    startedAt.current = Date.now();
    const data = await generateWorkoutForType(typeId);
    setSession(data);
    setPhase("session");
  }, []);

  useEffect(() => {
    if (initialTypeId && !initialized.current) {
      initialized.current = true;
      void selectType(initialTypeId);
    }
  }, [initialTypeId, selectType]);

  const handleCreateCustom = async (input: { name: string; category: WorkoutCategory }) => {
    const created = await createCustomWorkoutType(input);
    await selectType(created.id);
  };

  const elapsedMinutes = () => Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));

  const handleFinishWeightlifting = async (
    exercises: EditableExercise[],
    removedExerciseIds: string[]
  ) => {
    if (!session || session.mode !== "weightlifting") return;
    setPhase("finishing");
    const result = await completeWorkout({
      mode: "weightlifting",
      workoutTypeId: session.workoutTypeId,
      durationMinutes: elapsedMinutes(),
      removedExerciseIds,
      exercises: exercises.map((e) => ({
        exerciseId: e.exerciseId,
        movementCategory: e.movementCategory,
        reasonSelected: e.selectionReason,
        warmupWeight: e.warmup.weight,
        warmupReps: e.warmup.reps,
        sets: e.sets,
      })),
    });
    setRecap({ text: result.recap, prs: result.prsAchieved });
    setPhase("recap");
  };

  const handleFinishCardio = async (result: CardioResult) => {
    if (!session || session.mode !== "cardio") return;
    setPhase("finishing");
    const outcome = await completeWorkout({
      mode: "cardio",
      workoutTypeId: session.workoutTypeId,
      durationMinutes: elapsedMinutes(),
      ...result,
    });
    setRecap({ text: outcome.recap, prs: outcome.prsAchieved });
    setPhase("recap");
  };

  const handleFinishSimple = async (result: { notes: string | null }) => {
    if (!session || session.mode !== "simple") return;
    setPhase("finishing");
    const outcome = await completeWorkout({
      mode: "simple",
      workoutTypeId: session.workoutTypeId,
      durationMinutes: elapsedMinutes(),
      notes: result.notes,
    });
    setRecap({ text: outcome.recap, prs: outcome.prsAchieved });
    setPhase("recap");
  };

  if (phase === "select") {
    return (
      <WorkoutTypeSelector
        workoutTypes={workoutTypes}
        onSelect={selectType}
        onCreateCustom={handleCreateCustom}
      />
    );
  }

  if (phase === "loading") {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "recap" && recap) {
    return (
      <RecapScreen
        workoutTypeName={session?.workoutTypeName ?? "Workout"}
        recap={recap.text}
        prsAchieved={recap.prs}
      />
    );
  }

  if (!session) return null;

  const finishing = phase === "finishing";

  if (session.mode === "weightlifting") {
    return (
      <WeightliftingSession session={session} onFinish={handleFinishWeightlifting} finishing={finishing} />
    );
  }
  if (session.mode === "cardio") {
    return <CardioSessionForm session={session} onFinish={handleFinishCardio} finishing={finishing} />;
  }
  return <SimpleSessionForm session={session} onFinish={handleFinishSimple} finishing={finishing} />;
}
