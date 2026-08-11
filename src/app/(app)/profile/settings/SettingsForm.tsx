"use client";

import { useState, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  BLOCK_COUNT_OPTIONS,
  BLOCK_DURATION_OPTIONS,
  BLOCK_FOCUS_STYLE_OPTIONS,
  DELOAD_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  INJURY_OPTIONS,
  MUSCLE_PRIORITY_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  TRAINING_DAYS_OPTIONS,
  WORKOUT_PREFERENCE_OPTIONS,
} from "@/lib/data/questionnaire-options";
import type {
  BlockFocusStyle,
  DeloadPreference,
  EquipmentAccess,
  ExperienceLevel,
  InjuryArea,
  PrimaryGoal,
  TrainingCategory,
  WorkoutPreference,
} from "@/lib/types/enums";
import { updateQuestionnaireAnswers, type SettingsInput } from "./actions";

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function OptionRow({
  selected,
  label,
  hint,
  onClick,
  multi = false,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
        selected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/60"
      )}
    >
      {multi ? (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-input"
          )}
        >
          {selected ? <CheckIcon className="size-3.5" /> : null}
        </span>
      ) : (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary" : "border-input"
          )}
        >
          {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(initial.primaryGoal);
  const [musclePriorities, setMusclePriorities] = useState<TrainingCategory[]>(
    initial.musclePriorities
  );
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreference[]>(
    initial.workoutPreferences
  );
  const [equipmentAccess, setEquipmentAccess] = useState<EquipmentAccess>(initial.equipmentAccess);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(initial.experienceLevel);
  const [bodyWeight, setBodyWeight] = useState(
    initial.bodyWeightLb != null ? String(initial.bodyWeightLb) : ""
  );
  const [monthlyTarget, setMonthlyTarget] = useState(initial.monthlyWorkoutTarget);
  const [trainingDaysPerWeek, setTrainingDaysPerWeek] = useState(initial.trainingDaysPerWeek);
  const [injuryAreas, setInjuryAreas] = useState<InjuryArea[]>(initial.injuryAreas);
  const [injuryNote, setInjuryNote] = useState(initial.injuryNote ?? "");
  const [blockDurationWeeks, setBlockDurationWeeks] = useState(initial.blockDurationWeeks);
  const [blockCount, setBlockCount] = useState(initial.blockCount);
  const [blockFocusStyle, setBlockFocusStyle] = useState<BlockFocusStyle>(initial.blockFocusStyle);
  const [deloadPreference, setDeloadPreference] = useState<DeloadPreference>(initial.deloadPreference);
  const [status, setStatus] = useState<"idle" | "saved" | "error" | "weight_error">("idle");
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setStatus("idle");
    const weight = bodyWeight ? Number(bodyWeight) : null;
    if (weight != null && (!Number.isFinite(weight) || weight < 50 || weight > 1000)) {
      setStatus("weight_error");
      return;
    }
    startTransition(async () => {
      try {
        await updateQuestionnaireAnswers({
          primaryGoal,
          musclePriorities,
          workoutPreferences,
          equipmentAccess,
          experienceLevel,
          bodyWeightLb: bodyWeight ? Number(bodyWeight) : null,
          monthlyWorkoutTarget: monthlyTarget,
          trainingDaysPerWeek,
          injuryAreas,
          injuryNote: injuryNote.trim() || null,
          blockDurationWeeks,
          blockCount,
          blockFocusStyle,
          deloadPreference,
        });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    });
  };

  return (
    <div className="flex flex-col gap-7">
      <Section title="Main goal">
        <div className="flex flex-col gap-2">
          {PRIMARY_GOAL_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={primaryGoal === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setPrimaryGoal(o.value)}
            />
          ))}
        </div>
      </Section>

      {primaryGoal === "build_muscle" && (
        <Section title="Muscle priorities">
          <p className="text-xs text-muted-foreground">
            Pick what matters most — the first one becomes your top priority.
          </p>
          <div className="flex flex-col gap-2">
            {MUSCLE_PRIORITY_OPTIONS.map((o) => (
              <OptionRow
                key={o.value}
                multi
                selected={musclePriorities.includes(o.value)}
                label={o.label}
                onClick={() => setMusclePriorities((prev) => toggleValue(prev, o.value))}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Training days per week">
        <div className="flex flex-col gap-2">
          {TRAINING_DAYS_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={trainingDaysPerWeek === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setTrainingDaysPerWeek(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Injuries and limitations">
        <p className="text-xs text-muted-foreground">
          Movements that load these areas are left out of your plan. Alex isn&apos;t a medical
          professional — check with one if you&apos;re working through an injury.
        </p>
        <div className="flex flex-col gap-2">
          {INJURY_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              multi
              selected={injuryAreas.includes(o.value)}
              label={o.label}
              hint={o.hint}
              onClick={() => setInjuryAreas((prev) => toggleValue(prev, o.value))}
            />
          ))}
        </div>
        {injuryAreas.length > 0 ? (
          <Input
            placeholder="Anything else I should know? (optional)"
            value={injuryNote}
            onChange={(e) => setInjuryNote(e.target.value)}
            maxLength={280}
          />
        ) : null}
      </Section>

      <Section title="Workouts you enjoy">
        <div className="flex flex-col gap-2">
          {WORKOUT_PREFERENCE_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              multi
              selected={workoutPreferences.includes(o.value)}
              label={o.label}
              onClick={() => setWorkoutPreferences((prev) => toggleValue(prev, o.value))}
            />
          ))}
        </div>
      </Section>

      <Section title="Where you train">
        <div className="flex flex-col gap-2">
          {EQUIPMENT_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={equipmentAccess === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setEquipmentAccess(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Lifting experience">
        <div className="flex flex-col gap-2">
          {EXPERIENCE_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={experienceLevel === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setExperienceLevel(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Body weight">
        <div className="space-y-1.5">
          <Label htmlFor="bodyweight" className="text-xs text-muted-foreground">
            Used to calibrate starting weights. Changing it logs a new entry on your body-weight
            chart.
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="bodyweight"
              type="number"
              inputMode="decimal"
              min={50}
              max={1000}
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="max-w-32"
            />
            <span className="text-sm text-muted-foreground">lb</span>
          </div>
        </div>
      </Section>

      <Section title="Monthly workout target">
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {monthlyTarget} workouts <span className="text-muted-foreground">/ month</span>
          </p>
          <Slider
            value={[monthlyTarget]}
            min={8}
            max={25}
            step={1}
            onValueChange={([v]) => setMonthlyTarget(v)}
          />
        </div>
      </Section>

      <Section title="Block length">
        <div className="flex flex-col gap-2">
          {BLOCK_DURATION_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={blockDurationWeeks === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setBlockDurationWeeks(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Number of blocks">
        <div className="flex flex-col gap-2">
          {BLOCK_COUNT_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={blockCount === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setBlockCount(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Block focus">
        <div className="flex flex-col gap-2">
          {BLOCK_FOCUS_STYLE_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={blockFocusStyle === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setBlockFocusStyle(o.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="Recovery weeks">
        <div className="flex flex-col gap-2">
          {DELOAD_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              selected={deloadPreference === o.value}
              label={o.label}
              hint={o.hint}
              onClick={() => setDeloadPreference(o.value)}
            />
          ))}
        </div>
      </Section>

      <div className="flex items-center gap-3 pt-1">
        <Button size="lg" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
        {status === "saved" && !isPending ? (
          <p className="text-sm font-medium text-accent-text" role="status">
            Saved — Alex will use these from your next workout.
          </p>
        ) : null}
        {status === "error" && !isPending ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Couldn&apos;t save. Please try again.
          </p>
        ) : null}
        {status === "weight_error" ? (
          <p className="text-sm font-medium text-foreground" role="alert">
            Body weight should be between 50 and 1000 lb.
          </p>
        ) : null}
      </div>
    </div>
  );
}
