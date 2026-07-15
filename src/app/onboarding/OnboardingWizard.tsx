"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import { cn } from "@/lib/utils";
import type { ExperienceLevel } from "@/lib/types/enums";
import { completeOnboarding, type FirstWorkoutPreview } from "./actions";

const EXPERIENCE_OPTIONS: Array<{ value: ExperienceLevel; label: string; hint: string }> = [
  { value: "new", label: "New to lifting", hint: "Little to no strength training experience" },
  { value: "under_1_year", label: "Under 1 year", hint: "Getting the hang of the basics" },
  { value: "one_to_three_years", label: "1–3 years", hint: "Comfortable with most exercises" },
  { value: "three_plus_years", label: "3+ years", hint: "Experienced and consistent" },
];

type Step = "welcome" | "experience" | "bodyweight" | "monthly" | "plan";

export function OnboardingWizard() {
  const [step, setStep] = useState<Step>("welcome");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [bodyWeight, setBodyWeight] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(18);
  const [preview, setPreview] = useState<FirstWorkoutPreview | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setStep("plan");
    startTransition(async () => {
      const result = await completeOnboarding({
        experienceLevel: experienceLevel ?? "new",
        bodyWeightLb: bodyWeight ? Number(bodyWeight) : null,
        monthlyWorkoutTarget: monthlyTarget,
      });
      setPreview(result.preview);
    });
  };

  return (
    <div className="flex flex-col gap-8">
      {step !== "welcome" && step !== "plan" ? <StepProgress step={step} /> : null}

      {step === "welcome" && (
        <div className="flex flex-col gap-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
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
          <Button size="lg" onClick={() => setStep("experience")}>
            Let&apos;s get started
          </Button>
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
                    : "border-border hover:bg-secondary"
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
          <div className="space-y-4 rounded-xl border border-border p-4">
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
                <div className="space-y-2 rounded-xl border border-border p-4">
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

function StepProgress({ step }: { step: Step }) {
  const steps: Step[] = ["experience", "bodyweight", "monthly"];
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
