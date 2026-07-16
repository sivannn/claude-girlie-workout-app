"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon } from "lucide-react";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { cn } from "@/lib/utils";
import type {
  EquipmentAccess,
  ExperienceLevel,
  PrimaryGoal,
  TrainingCategory,
  WorkoutPreference,
} from "@/lib/types/enums";
import { completeOnboarding, type FirstWorkoutPreview } from "./actions";

const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string; hint: string }> = [
  { value: "new", label: "New to lifting", hint: "Little to no strength training experience" },
  { value: "under_1_year", label: "Under 1 year", hint: "Getting the hang of the basics" },
  { value: "one_to_three_years", label: "1–3 years", hint: "Comfortable with most exercises" },
  { value: "three_plus_years", label: "3+ years", hint: "Experienced and consistent" },
];

const PRIMARY_GOAL_OPTIONS: Array<{ value: PrimaryGoal; label: string; hint: string }> = [
  { value: "build_muscle", label: "Build muscle", hint: "Grow strength and size in specific areas" },
  { value: "lose_fat", label: "Lose fat", hint: "Lean out while staying strong" },
  { value: "build_strength", label: "Build strength", hint: "Get better at lifting heavy" },
  { value: "stay_active", label: "Stay active", hint: "Keep a consistent, healthy routine" },
  { value: "other", label: "Something else", hint: "I'll figure out the details as we go" },
];

const MUSCLE_PRIORITY_OPTIONS: Array<{ value: TrainingCategory; label: string }> = [
  { value: "glutes_legs", label: "Legs & Glutes" },
  { value: "back_biceps", label: "Back & Biceps" },
  { value: "chest_triceps", label: "Chest & Triceps" },
  { value: "abs", label: "Abs" },
];

const WORKOUT_PREFERENCE_OPTIONS: Array<{ value: WorkoutPreference; label: string }> = [
  { value: "weightlifting", label: "Weightlifting" },
  { value: "pilates", label: "Pilates" },
  { value: "yoga", label: "Yoga" },
  { value: "running", label: "Running" },
  { value: "hiking", label: "Hiking" },
  { value: "cycling", label: "Cycling" },
  { value: "swimming", label: "Swimming" },
  { value: "sports", label: "Sports (tennis, pickleball, etc.)" },
  { value: "other", label: "Something else" },
];

const EQUIPMENT_OPTIONS: Array<{ value: EquipmentAccess; label: string; hint: string }> = [
  { value: "commercial_gym", label: "Commercial gym", hint: "Full range of machines, barbells, and cables" },
  { value: "home_gym", label: "Home gym", hint: "Barbell, rack, and dumbbells" },
  { value: "apartment_gym", label: "Apartment/building gym", hint: "A smaller selection of machines and dumbbells" },
  { value: "bodyweight_only", label: "Bodyweight only", hint: "No equipment, or just resistance bands" },
];

type Step =
  | "welcome"
  | "primary_goal"
  | "muscle_priorities"
  | "workout_preferences"
  | "equipment"
  | "experience"
  | "bodyweight"
  | "monthly"
  | "plan";

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function CheckboxIndicator({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
      )}
    >
      {checked ? <CheckIcon className="size-3.5" /> : null}
    </span>
  );
}

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [musclePriorities, setMusclePriorities] = useState<TrainingCategory[]>([]);
  const [workoutPreferences, setWorkoutPreferences] = useState<WorkoutPreference[]>([]);
  const [equipmentAccess, setEquipmentAccess] = useState<EquipmentAccess | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [bodyWeight, setBodyWeight] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(18);
  const [preview, setPreview] = useState<FirstWorkoutPreview | null>(null);
  const [isPending, startTransition] = useTransition();

  const afterPrimaryGoalStep: Step = primaryGoal === "build_muscle" ? "muscle_priorities" : "workout_preferences";
  const beforeWorkoutPreferencesStep: Step = primaryGoal === "build_muscle" ? "muscle_priorities" : "primary_goal";

  const submit = () => {
    setStep("plan");
    startTransition(async () => {
      const result = await completeOnboarding({
        experienceLevel: experienceLevel ?? "new",
        bodyWeightLb: bodyWeight ? Number(bodyWeight) : null,
        monthlyWorkoutTarget: monthlyTarget,
        primaryGoal: primaryGoal ?? "stay_active",
        musclePriorities,
        workoutPreferences,
        equipmentAccess: equipmentAccess ?? "bodyweight_only",
      });
      setPreview(result.preview);
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {step !== "welcome" && step !== "plan" ? <StepProgress step={step} showMusclePriorities={primaryGoal === "build_muscle"} /> : null}

      {step === "welcome" && (
        <div className="flex flex-col gap-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-alex text-lg font-semibold text-alex-foreground">
            A
          </span>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Hey, I&apos;m Alex — your AI coach.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Give me a minute to learn the basics and I&apos;ll build your first workout. Just a
              couple quick questions — nothing you can&apos;t change later.
            </p>
          </div>
          <Button size="lg" onClick={() => setStep("primary_goal")}>
            Let&apos;s get started
          </Button>
        </div>
      )}

      {step === "primary_goal" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">What&apos;s your main goal?</h2>
            <p className="text-sm text-muted-foreground">
              This shapes how I prioritize your recommendations. You can always add more goals later.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {PRIMARY_GOAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPrimaryGoal(option.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  primaryGoal === option.value ? "border-accent bg-accent/10" : "tile hover:bg-secondary"
                )}
              >
                <div className="font-medium text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("welcome")}>
              Back
            </Button>
            <Button className="flex-1" disabled={!primaryGoal} onClick={() => setStep(afterPrimaryGoalStep)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "muscle_priorities" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              Which muscle groups matter most to you?
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick as many as you like. I&apos;ll prioritize these in your recommendations and goal
              suggestions.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {MUSCLE_PRIORITY_OPTIONS.map((option) => {
              const checked = musclePriorities.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMusclePriorities((prev) => toggleValue(prev, option.value))}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                    checked ? "border-accent bg-accent/10" : "tile hover:bg-secondary"
                  )}
                >
                  <CheckboxIndicator checked={checked} />
                  <span className="font-medium text-foreground">{option.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("primary_goal")}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={musclePriorities.length === 0}
              onClick={() => setStep("workout_preferences")}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "workout_preferences" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              What kinds of workouts do you enjoy?
            </h2>
            <p className="text-sm text-muted-foreground">
              Pick as many as you like. I&apos;ll weave these into your recommendations alongside
              your strength training.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {WORKOUT_PREFERENCE_OPTIONS.map((option) => {
              const checked = workoutPreferences.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWorkoutPreferences((prev) => toggleValue(prev, option.value))}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-colors",
                    checked ? "border-accent bg-accent/10" : "tile hover:bg-secondary"
                  )}
                >
                  <CheckboxIndicator checked={checked} />
                  <span className="text-sm font-medium text-foreground">{option.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep(beforeWorkoutPreferencesStep)}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={workoutPreferences.length === 0}
              onClick={() => setStep("equipment")}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "equipment" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">Where do you usually train?</h2>
            <p className="text-sm text-muted-foreground">
              I&apos;ll only recommend exercises that match the equipment you actually have access to.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {EQUIPMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setEquipmentAccess(option.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  equipmentAccess === option.value ? "border-accent bg-accent/10" : "tile hover:bg-secondary"
                )}
              >
                <div className="font-medium text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("workout_preferences")}>
              Back
            </Button>
            <Button className="flex-1" disabled={!equipmentAccess} onClick={() => setStep("experience")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "experience" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              How much lifting experience do you have?
            </h2>
            <p className="text-sm text-muted-foreground">
              This helps me pick a sensible starting weight for your first workout — every set is
              editable, so it never has to be perfect.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {EXPERIENCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setExperienceLevel(option.value)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors",
                  experienceLevel === option.value
                    ? "border-accent bg-accent/10"
                    : "tile hover:bg-secondary"
                )}
              >
                <div className="font-medium text-foreground">{option.label}</div>
                <div className="text-xs text-muted-foreground">{option.hint}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("equipment")}>
              Back
            </Button>
            <Button className="flex-1" disabled={!experienceLevel} onClick={() => setStep("bodyweight")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "bodyweight" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">What&apos;s your body weight?</h2>
            <p className="text-sm text-muted-foreground">
              Totally optional — it helps me fine-tune your starting weights, and I&apos;ll track it
              on your Progress page over time.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="e.g. 150"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              className="text-base"
            />
            <span className="text-sm text-muted-foreground">lb</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("experience")}>
              Back
            </Button>
            <Button variant="secondary" onClick={() => { setBodyWeight(""); setStep("monthly"); }}>
              Skip
            </Button>
            <Button className="flex-1" onClick={() => setStep("monthly")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "monthly" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">
              How many workouts a month feels realistic?
            </h2>
            <p className="text-sm text-muted-foreground">
              This sets your monthly consistency goal on the Home page. Most people land around
              16–20 — you can change this anytime.
            </p>
          </div>
          <div className="tile space-y-4 rounded-xl border p-4">
            <div className="text-center text-3xl font-semibold tabular-nums text-foreground">
              {monthlyTarget}
            </div>
            <Slider
              min={8}
              max={25}
              step={1}
              value={[monthlyTarget]}
              onValueChange={(v) => setMonthlyTarget(v[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>8</span>
              <span>25</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("bodyweight")}>
              Back
            </Button>
            <Button className="flex-1" onClick={submit}>
              Build my game plan
            </Button>
          </div>
        </div>
      )}

      {step === "plan" && (
        <div className="flex flex-col gap-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold text-foreground">Your game plan</h2>
            <p className="text-sm text-muted-foreground">
              Here&apos;s what I&apos;d recommend to start.
            </p>
          </div>

          {isPending || !preview ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <CategoryBadge colorKey={preview.colorKey} label={preview.workoutTypeName} />
                <span className="text-sm text-muted-foreground">
                  ~{preview.estimatedDurationMinutes} min
                </span>
              </div>

              <AlexNote title="Why this workout">{preview.reason}</AlexNote>

              {preview.exercises.length > 0 ? (
                <div className="tile space-y-2 rounded-xl border p-4">
                  {preview.exercises.map((ex) => (
                    <div key={ex.name} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">{ex.name}</span>
                      <span className="text-muted-foreground">{ex.movementCategoryLabel}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button size="lg" asChild>
                  <Link href={`/workout/new?type=${preview.workoutTypeId}`}>Start this workout</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/">Go to my dashboard</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StepProgress({ step, showMusclePriorities }: { step: Step; showMusclePriorities: boolean }) {
  const steps: Step[] = [
    "primary_goal",
    ...(showMusclePriorities ? (["muscle_priorities"] as Step[]) : []),
    "workout_preferences",
    "equipment",
    "experience",
    "bodyweight",
    "monthly",
  ];
  const currentIndex = steps.indexOf(step);
  return (
    <div className="flex gap-1.5">
      {steps.map((s, i) => (
        <div
          key={s}
          className={cn(
            "h-1 flex-1 rounded-full",
            i <= currentIndex ? "bg-accent" : "bg-secondary"
          )}
        />
      ))}
    </div>
  );
}
