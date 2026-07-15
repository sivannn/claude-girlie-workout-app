"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlexNote } from "@/components/shared/AlexNote";
import type { TrainingCategory } from "@/lib/types/enums";
import { acceptGoalSuggestion, dismissGoalSuggestion } from "./actions";

export function GoalSuggestionCard({
  suggestion,
}: {
  suggestion: {
    completedGoalId: string;
    exerciseId: string;
    category: string;
    title: string;
    unit: string;
    suggestedNext: number;
    message: string;
  };
}) {
  const router = useRouter();
  const [customizing, setCustomizing] = useState(false);
  const [target, setTarget] = useState(String(suggestion.suggestedNext));
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const accept = async () => {
    setBusy(true);
    await acceptGoalSuggestion({
      completedGoalId: suggestion.completedGoalId,
      exerciseId: suggestion.exerciseId,
      category: suggestion.category as TrainingCategory,
      targetValue: Number(target),
    });
    setBusy(false);
    router.refresh();
  };

  const later = async () => {
    setDismissed(true);
    await dismissGoalSuggestion(suggestion.completedGoalId);
    router.refresh();
  };

  return (
    <AlexNote title="New goal suggestion">
      <p>{suggestion.message}</p>
      {customizing ? (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-24"
          />
          <span className="text-xs">{suggestion.unit}</span>
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={accept}>
          Accept
        </Button>
        {!customizing ? (
          <Button size="sm" variant="outline" onClick={() => setCustomizing(true)}>
            Customize
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={busy} onClick={later}>
          Later
        </Button>
      </div>
    </AlexNote>
  );
}
