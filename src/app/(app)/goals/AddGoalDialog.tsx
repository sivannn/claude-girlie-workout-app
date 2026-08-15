"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlexNote } from "@/components/shared/AlexNote";
import { CATEGORY_NAME } from "@/lib/data/category-descriptions";
import { TRAINING_CATEGORIES, type Priority, type TrainingCategory } from "@/lib/types/enums";
import { createGoal, getExercisesForCategory, suggestGoalFromRequest } from "./actions";

type ExerciseOption = { id: string; name: string; unit: string };

export function AddGoalDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Manual tab state
  const [category, setCategory] = useState<TrainingCategory>("glutes_legs");
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [exerciseId, setExerciseId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [saving, setSaving] = useState(false);

  // AI tab state
  const [request, setRequest] = useState("");
  const [asking, setAsking] = useState(false);
  const [suggestion, setSuggestion] = useState<Awaited<ReturnType<typeof suggestGoalFromRequest>> | null>(
    null
  );
  const [suggestionTarget, setSuggestionTarget] = useState("");

  const loadExercises = async (cat: TrainingCategory) => {
    setCategory(cat);
    setExerciseId("");
    const options = await getExercisesForCategory(cat);
    setExercises(options);
  };

  const resetAndClose = () => {
    setOpen(false);
    setExerciseId("");
    setTargetValue("");
    setRequest("");
    setSuggestion(null);
    setSuggestionTarget("");
    router.refresh();
  };

  const handleManualSubmit = async () => {
    if (!exerciseId || !targetValue) return;
    setSaving(true);
    await createGoal({ category, exerciseId, targetValue: Number(targetValue), priority });
    setSaving(false);
    resetAndClose();
  };

  const handleAskAlex = async () => {
    if (!request.trim()) return;
    setAsking(true);
    const result = await suggestGoalFromRequest(request.trim());
    setSuggestion(result);
    setSuggestionTarget(result.suggestedTarget != null ? String(result.suggestedTarget) : "");
    setAsking(false);
  };

  const handleAcceptSuggestion = async () => {
    if (!suggestion?.exerciseId || !suggestion.category || !suggestionTarget) return;
    setSaving(true);
    await createGoal({
      category: suggestion.category,
      exerciseId: suggestion.exerciseId,
      targetValue: Number(suggestionTarget),
      priority: "MEDIUM",
    });
    setSaving(false);
    resetAndClose();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          + Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a goal</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ai">
          <TabsList className="w-full">
            <TabsTrigger value="ai" className="flex-1">
              Ask the AI Coach
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex-1">
              Create Manually
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="flex flex-col gap-4 pt-2">
            <div className="space-y-1.5">
              <Label>Describe your goal</Label>
              <Textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="e.g. I want bigger glutes"
                rows={2}
              />
            </div>
            <Button variant="secondary" disabled={!request.trim() || asking} onClick={handleAskAlex}>
              {asking ? "Thinking…" : "Ask Alex"}
            </Button>

            {suggestion ? (
              <div className="space-y-3">
                <AlexNote>{suggestion.explanation}</AlexNote>
                {suggestion.exerciseId ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{suggestion.exerciseName}</span>
                    <Input
                      type="number"
                      value={suggestionTarget}
                      onChange={(e) => setSuggestionTarget(e.target.value)}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">{suggestion.unit}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Try the Create Manually tab to pick a specific exercise.
                  </p>
                )}
              </div>
            ) : null}

            {suggestion?.exerciseId ? (
              <DialogFooter>
                <Button disabled={saving} onClick={handleAcceptSuggestion}>
                  {saving ? "Saving…" : "Accept Goal"}
                </Button>
              </DialogFooter>
            ) : null}
          </TabsContent>

          <TabsContent value="manual" className="flex flex-col gap-4 pt-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => loadExercises(v as TrainingCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_NAME[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Exercise</Label>
              <Select
                value={exerciseId}
                onValueChange={setExerciseId}
                onOpenChange={(o) => {
                  if (o && exercises.length === 0) void loadExercises(category);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an exercise" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Goal</Label>
              <Input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="e.g. 200"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button disabled={!exerciseId || !targetValue || saving} onClick={handleManualSubmit}>
                {saving ? "Saving…" : "Create Goal"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
