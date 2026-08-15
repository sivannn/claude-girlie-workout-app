"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { parseLocalDateInput } from "@/lib/utils/date";
import type { WorkoutCategory } from "@/lib/types/enums";
import { WorkoutTypeSelector, type WorkoutTypeOption, type PickerGroup } from "./WorkoutTypeSelector";
import { WorkoutCategoryPicker } from "./WorkoutCategoryPicker";
import { WeightliftingSession } from "./WeightliftingSession";
import { CardioSessionForm, type CardioResult } from "./CardioSessionForm";
import { SimpleSessionForm } from "./SimpleSessionForm";
import { RecapScreen } from "./RecapScreen";
import {
  completeWorkout,
  createCustomWorkoutType,
  generateWorkoutForType,
  loadDraftWorkout,
} from "./actions";
import type { DraftWeightliftingPayload, EditableExercise } from "./sessionState";
import type { GeneratedSessionData } from "./types";

type Phase = "select" | "loading" | "session" | "finishing" | "recap";

export function StartWorkoutFlow({
  workoutTypes,
  initialTypeId,
  initialResumeId,
  initialCategory,
  targetDate = null,
}: {
  workoutTypes: WorkoutTypeOption[];
  initialTypeId: string | null;
  initialResumeId: string | null;
  initialCategory: PickerGroup | null;
  /** When set ("yyyy-MM-dd"), the whole flow logs a previous workout for that day instead of a live session. */
  targetDate?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>(initialTypeId || initialResumeId ? "loading" : "select");
  const [session, setSession] = useState<GeneratedSessionData | null>(null);
  const [recap, setRecap] = useState<{ text: string; prs: string[] } | null>(null);
  // Surfaced when finishing fails so a completed workout is never silently lost.
  const [finishError, setFinishError] = useState<string | null>(null);
  const [draftEventId, setDraftEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftWeightliftingPayload | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PickerGroup | null>(initialCategory);
  const startedAt = useRef<number>(0);
  const initialized = useRef(false);

  const selectType = useCallback(
    async (typeId: string) => {
      setPhase("loading");
      startedAt.current = Date.now();
      const data = await generateWorkoutForType(typeId, targetDate);
      setSession(data);
      setPhase("session");
    },
    [targetDate]
  );

  const resumeDraft = useCallback(async (eventId: string) => {
    setPhase("loading");
    startedAt.current = Date.now();
    const result = await loadDraftWorkout(eventId);
    if (!result) {
      setPhase("select");
      return;
    }
    setSession({
      mode: "weightlifting",
      workoutTypeId: result.draft.workoutTypeId,
      workoutTypeName: result.draft.workoutTypeName,
      colorKey: result.draft.colorKey,
      brief: result.draft.brief,
      exercises: [],
      abExercise: null,
    });
    setDraft(result.draft);
    setDraftEventId(result.draftEventId);
    setPhase("session");
  }, []);

  useEffect(() => {
    // Drafts are a live-session affordance; a backdated log never resumes one.
    if (initialResumeId && !targetDate && !initialized.current) {
      initialized.current = true;
      void resumeDraft(initialResumeId);
    }
  }, [initialResumeId, targetDate, resumeDraft]);

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

  // Backdated logs send the target day plus the browser's today, so a UTC
  // server enforces the one-month window against the user's clock, not its own.
  const backdateFields = targetDate
    ? { targetDate, clientToday: format(new Date(), "yyyy-MM-dd") }
    : {};

  const handleFinishWeightlifting = async (
    exercises: EditableExercise[],
    removedExerciseIds: string[],
    manualDurationMinutes: number | null
  ) => {
    if (!session || session.mode !== "weightlifting") return;
    setPhase("finishing");
    try {
      const result = await completeWorkout({
        mode: "weightlifting",
        workoutTypeId: session.workoutTypeId,
        durationMinutes: targetDate ? (manualDurationMinutes ?? 1) : elapsedMinutes(),
        removedExerciseIds,
        draftEventId,
        ...backdateFields,
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
    } catch {
      // Finishing failed — most likely an expired session or a dropped
      // connection. Never swallow a completed workout: go back to the session
      // with everything still filled in so it can be retried.
      setFinishError(
        "Couldn't save that workout — you may have been signed out. Your sets are still here; log back in in another tab and press Finish again."
      );
      setPhase("session");
    }
  };

  const handleFinishCardio = async (result: CardioResult) => {
    if (!session || session.mode !== "cardio") return;
    setPhase("finishing");
    try {
      const outcome = await completeWorkout({
        mode: "cardio",
        workoutTypeId: session.workoutTypeId,
        // A backdated cardio log takes its duration from the entered time
        // (required in that mode) — the elapsed form-filling time means nothing.
        durationMinutes: targetDate
          ? Math.max(1, Math.round((result.timeSeconds ?? 60) / 60))
          : elapsedMinutes(),
        ...result,
        ...backdateFields,
      });
      setRecap({ text: outcome.recap, prs: outcome.prsAchieved });
      setPhase("recap");
    } catch {
      setFinishError(
        "Couldn't save that workout — you may have been signed out. Nothing you entered is lost; log back in in another tab and press Finish again."
      );
      setPhase("session");
    }
  };

  const handleFinishSimple = async (result: {
    notes: string | null;
    durationMinutes: number | null;
  }) => {
    if (!session || session.mode !== "simple") return;
    setPhase("finishing");
    try {
      const outcome = await completeWorkout({
        mode: "simple",
        workoutTypeId: session.workoutTypeId,
        durationMinutes: targetDate ? (result.durationMinutes ?? 1) : elapsedMinutes(),
        notes: result.notes,
        ...backdateFields,
      });
      setRecap({ text: outcome.recap, prs: outcome.prsAchieved });
      setPhase("recap");
    } catch {
      setFinishError(
        "Couldn't save that workout — you may have been signed out. Nothing you entered is lost; log back in in another tab and press Finish again."
      );
      setPhase("session");
    }
  };

  if (phase === "select") {
    if (!selectedGroup) {
      return <WorkoutCategoryPicker workoutTypes={workoutTypes} onSelectGroup={setSelectedGroup} />;
    }
    return (
      <WorkoutTypeSelector
        workoutTypes={workoutTypes}
        group={selectedGroup}
        onSelect={selectType}
        onBack={() => setSelectedGroup(null)}
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

  const targetDateLabel = targetDate ? format(parseLocalDateInput(targetDate), "EEEE, MMMM d") : null;

  if (phase === "recap" && recap) {
    return (
      <RecapScreen
        workoutTypeName={session?.workoutTypeName ?? "Workout"}
        recap={recap.text}
        prsAchieved={recap.prs}
        loggedForLabel={targetDateLabel}
      />
    );
  }

  if (!session) return null;

  const finishing = phase === "finishing";

  // Shown above the session when a finish attempt failed, so the user knows
  // their logged work is still here and what to do about it.
  const finishBanner = finishError ? (
    <p
      className="mb-4 rounded-md bg-destructive/15 px-3 py-2 text-sm font-medium text-foreground"
      role="alert"
    >
      {finishError}
    </p>
  ) : null;

  // Constant reminder that this session isn't "now" — everything entered
  // below lands on the chosen past day.
  const backdateBanner = targetDateLabel ? (
    <p className="mb-4 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-foreground">
      Logging a previous workout for {targetDateLabel}
    </p>
  ) : null;

  if (session.mode === "weightlifting") {
    return (
      <>
        {backdateBanner}
        {finishBanner}
        <WeightliftingSession
          session={session}
          initialExercises={draft?.exercises}
          initialAbExercise={draft?.abExercise}
          initialRemovedIds={draft?.removedExerciseIds}
          draftEventId={draftEventId}
          backdated={targetDate != null}
          onFinish={handleFinishWeightlifting}
          finishing={finishing}
        />
      </>
    );
  }
  if (session.mode === "cardio") {
    return (
      <>
        {backdateBanner}
        {finishBanner}
        <CardioSessionForm
          session={session}
          backdated={targetDate != null}
          onFinish={handleFinishCardio}
          finishing={finishing}
        />
      </>
    );
  }
  return (
    <>
      {backdateBanner}
      {finishBanner}
      <SimpleSessionForm
        session={session}
        backdated={targetDate != null}
        onFinish={handleFinishSimple}
        finishing={finishing}
      />
    </>
  );
}
