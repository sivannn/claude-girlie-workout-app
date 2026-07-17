import type { GeneratedExerciseView } from "./types";

export type EditableSet = {
  setNumber: number;
  recommendedWeight: number | null;
  recommendedRepsLow: number;
  recommendedRepsHigh: number;
  actualWeight: number | null;
  actualReps: number | null;
};

export type EditableExercise = Omit<GeneratedExerciseView, "workingSets"> & {
  sets: EditableSet[];
};

export function toEditableExercise(view: GeneratedExerciseView): EditableExercise {
  const { workingSets, ...rest } = view;
  return {
    ...rest,
    sets: workingSets.map((s) => ({
      ...s,
      actualWeight: s.recommendedWeight,
      actualReps: null,
    })),
  };
}

export function parseNumberInput(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Full in-progress weightlifting session state, JSON-serialized into a "save & exit" draft. */
export type DraftWeightliftingPayload = {
  workoutTypeId: string;
  workoutTypeName: string;
  colorKey: string;
  brief: string;
  exercises: EditableExercise[];
  abExercise: EditableExercise | null;
  removedExerciseIds: string[];
};
