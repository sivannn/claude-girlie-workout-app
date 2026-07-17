"use client";

import { categoryColorVar } from "@/lib/design/categories";
import { GROUP_LABEL, groupOf, type WorkoutTypeOption, type PickerGroup } from "./WorkoutTypeSelector";

const STEP_ONE_GROUPS: Exclude<PickerGroup, "FUN_ALL">[] = [
  "WEIGHTLIFTING",
  "CARDIO",
  "CLASS",
  "FUN_ACTIVITY",
  "RECOVERY",
];

export function WorkoutCategoryPicker({
  workoutTypes,
  onSelectGroup,
}: {
  workoutTypes: WorkoutTypeOption[];
  onSelectGroup: (group: PickerGroup) => void;
}) {
  // Only show a tile for a group that has at least one workout type in it —
  // e.g. "Recovery" stays hidden until the user creates a custom one.
  const groups = STEP_ONE_GROUPS.filter((g) => workoutTypes.some((t) => groupOf(t) === g));
  const sampleColorKey = (g: PickerGroup) => workoutTypes.find((t) => groupOf(t) === g)!.colorKey;

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          What are we doing today?
        </h1>
        <p className="text-sm text-muted-foreground">Pick a category to get started.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {groups.map((group) => (
          <button
            key={group}
            type="button"
            onClick={() => onSelectGroup(group)}
            className="tile flex flex-col gap-2 rounded-xl border p-5 text-left transition-colors hover:bg-secondary"
          >
            <span
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: categoryColorVar(sampleColorKey(group)) }}
            />
            <span className="font-medium text-foreground">{GROUP_LABEL[group]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
