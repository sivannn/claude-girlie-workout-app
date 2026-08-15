"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlexNote } from "@/components/shared/AlexNote";
import { CategoryBadge } from "@/components/shared/CategoryBadge";
import type { CardioSessionData } from "./types";

export type CardioResult = {
  indoorOutdoor: "indoor" | "outdoor";
  timeSeconds: number | null;
  distanceMiles: number | null;
};

export function CardioSessionForm({
  session,
  backdated = false,
  onFinish,
  finishing,
}: {
  session: CardioSessionData;
  /** Logging a previous session: the time field doubles as the duration, so it's required. */
  backdated?: boolean;
  onFinish: (result: CardioResult) => void;
  finishing: boolean;
}) {
  const [indoorOutdoor, setIndoorOutdoor] = useState<"indoor" | "outdoor">("outdoor");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [distance, setDistance] = useState("");
  const router = useRouter();

  const missingRequiredTime = backdated && !minutes && !seconds;

  const submit = () => {
    const totalSeconds =
      minutes || seconds ? (Number(minutes) || 0) * 60 + (Number(seconds) || 0) : null;
    onFinish({
      indoorOutdoor,
      timeSeconds: totalSeconds,
      distanceMiles: distance ? Number(distance) : null,
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <CategoryBadge colorKey={session.colorKey} label={session.workoutTypeName} />

      <AlexNote title={backdated ? "That day's target" : "Today's target"}>
        {session.reason}
        {session.recommendedDistanceMiles != null ? ` Target distance: ${session.recommendedDistanceMiles} mi.` : ""}
        {session.recommendedTimeSeconds != null
          ? ` Target time: ${Math.round(session.recommendedTimeSeconds / 60)} min.`
          : ""}
      </AlexNote>

      <div className="space-y-1.5">
        <Label>Indoor or outdoor?</Label>
        <Select value={indoorOutdoor} onValueChange={(v) => setIndoorOutdoor(v as "indoor" | "outdoor")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="outdoor">Outdoor</SelectItem>
            <SelectItem value="indoor">Indoor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>{backdated ? "Time (required)" : "Time"}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            placeholder="min"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <Input
            type="number"
            inputMode="numeric"
            placeholder="sec"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Distance (mi)</Label>
        <Input
          type="number"
          inputMode="decimal"
          placeholder="e.g. 2.5"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        />
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          disabled={finishing}
          onClick={() => router.push(backdated ? "/calendar" : "/")}
        >
          Exit
        </Button>
        <Button
          size="lg"
          className="flex-[2]"
          disabled={finishing || missingRequiredTime}
          onClick={submit}
        >
          {finishing ? "Saving…" : backdated ? "Log Workout" : "Finish Workout"}
        </Button>
      </div>
    </div>
  );
}
