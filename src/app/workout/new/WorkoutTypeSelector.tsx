"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { categoryColorVar } from "@/lib/design/categories";
import type { WorkoutCategory } from "@/lib/types/enums";
import { cn } from "@/lib/utils";

export type WorkoutTypeOption = {
  id: string;
  name: string;
  category: string;
  colorKey: string;
};

const CATEGORY_ORDER: WorkoutCategory[] = ["WEIGHTLIFTING", "CARDIO", "FUN", "RECOVERY"];
const CATEGORY_HEADING: Record<WorkoutCategory, string> = {
  WEIGHTLIFTING: "Weightlifting",
  CARDIO: "Cardio",
  FUN: "Fun / Lifestyle",
  RECOVERY: "Recovery",
};

export function WorkoutTypeSelector({
  workoutTypes,
  onSelect,
  onCreateCustom,
}: {
  workoutTypes: WorkoutTypeOption[];
  onSelect: (typeId: string) => void;
  onCreateCustom: (input: { name: string; category: WorkoutCategory }) => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<WorkoutCategory>("FUN");
  const [creating, setCreating] = useState(false);

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    types: workoutTypes.filter((t) => t.category === category),
  })).filter((g) => g.types.length > 0);

  const handleCreate = async () => {
    if (!customName.trim()) return;
    setCreating(true);
    await onCreateCustom({ name: customName.trim(), category: customCategory });
    setCreating(false);
    setDialogOpen(false);
    setCustomName("");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          What are we doing today?
        </h1>
        <p className="text-sm text-muted-foreground">Pick a workout type to get started.</p>
      </div>

      {grouped.map((group) => (
        <div key={group.category} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {CATEGORY_HEADING[group.category]}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {group.types.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => onSelect(type.id)}
                className="flex flex-col gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:bg-secondary"
              >
                <span
                  className="h-2 w-8 rounded-full"
                  style={{ backgroundColor: categoryColorVar(type.colorKey) }}
                />
                <span className="font-medium text-foreground">{type.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
            )}
          >
            + Other — add a new workout type
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workout type</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="e.g. Rock Climbing"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Category</label>
              <Select
                value={customCategory}
                onValueChange={(v) => setCustomCategory(v as WorkoutCategory)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FUN">Fun / Lifestyle</SelectItem>
                  <SelectItem value="CARDIO">Cardio</SelectItem>
                  <SelectItem value="RECOVERY">Recovery / Maintenance</SelectItem>
                  <SelectItem value="WEIGHTLIFTING">Weightlifting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button disabled={!customName.trim() || creating} onClick={handleCreate}>
              {creating ? "Creating…" : "Create & Start"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
