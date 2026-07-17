"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
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
import { CLASS_TYPE_NAMES } from "@/lib/data/workout-types";
import type { WorkoutCategory } from "@/lib/types/enums";
import { cn } from "@/lib/utils";

export type WorkoutTypeOption = {
  id: string;
  name: string;
  category: string;
  colorKey: string;
};

// "CLASS" and "FUN_ACTIVITY" are UI-only splits of the FUN category (see
// CLASS_TYPE_NAMES) — no schema/weekly-goal changes. "FUN_ALL" shows every
// FUN-category type ungrouped, used when entering from the homepage's single
// "Fun Activity" weekly-goal bucket, which doesn't distinguish the two.
export type PickerGroup = "WEIGHTLIFTING" | "CARDIO" | "CLASS" | "FUN_ACTIVITY" | "FUN_ALL" | "RECOVERY";

export const GROUP_LABEL: Record<PickerGroup, string> = {
  WEIGHTLIFTING: "Weightlifting",
  CARDIO: "Cardio",
  CLASS: "Class",
  FUN_ACTIVITY: "Fun Activity",
  FUN_ALL: "Fun / Lifestyle",
  RECOVERY: "Recovery",
};

const GROUP_TO_CATEGORY: Record<PickerGroup, WorkoutCategory> = {
  WEIGHTLIFTING: "WEIGHTLIFTING",
  CARDIO: "CARDIO",
  CLASS: "FUN",
  FUN_ACTIVITY: "FUN",
  FUN_ALL: "FUN",
  RECOVERY: "RECOVERY",
};

export function groupOf(type: WorkoutTypeOption): Exclude<PickerGroup, "FUN_ALL"> {
  if (type.category === "WEIGHTLIFTING") return "WEIGHTLIFTING";
  if (type.category === "CARDIO") return "CARDIO";
  if (type.category === "RECOVERY") return "RECOVERY";
  return CLASS_TYPE_NAMES.includes(type.name) ? "CLASS" : "FUN_ACTIVITY";
}

function typesInGroup(workoutTypes: WorkoutTypeOption[], group: PickerGroup): WorkoutTypeOption[] {
  if (group === "FUN_ALL") return workoutTypes.filter((t) => t.category === "FUN");
  return workoutTypes.filter((t) => groupOf(t) === group);
}

export function WorkoutTypeSelector({
  workoutTypes,
  group,
  onSelect,
  onBack,
  onCreateCustom,
}: {
  workoutTypes: WorkoutTypeOption[];
  group: PickerGroup;
  onSelect: (typeId: string) => void;
  onBack: () => void;
  onCreateCustom: (input: { name: string; category: WorkoutCategory }) => Promise<void>;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState<WorkoutCategory>(GROUP_TO_CATEGORY[group]);
  const [creating, setCreating] = useState(false);

  const types = typesInGroup(workoutTypes, group);

  const handleCreate = async () => {
    if (!customName.trim()) return;
    setCreating(true);
    await onCreateCustom({ name: customName.trim(), category: customCategory });
    setCreating(false);
    setDialogOpen(false);
    setCustomName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1.5">
        <Button variant="ghost" size="sm" className="-ml-2 gap-1 text-muted-foreground" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{GROUP_LABEL[group]}</h1>
        <p className="text-sm text-muted-foreground">Pick a workout type to get started.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {types.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type.id)}
            className="tile flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-secondary"
          >
            <span
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: categoryColorVar(type.colorKey) }}
            />
            <span className="font-medium text-foreground">{type.name}</span>
          </button>
        ))}
      </div>

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
