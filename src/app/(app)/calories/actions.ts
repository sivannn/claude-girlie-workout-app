"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeMealPhoto, type MealAnalysis } from "@/lib/ai/alex";
import { parseLocalDateInput } from "@/lib/utils/date";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

export type MealAnalysisResult =
  | { ok: true; analysis: MealAnalysis }
  | { ok: false; reason: "unsupported" | "too_large" | "unavailable" };

/**
 * Sends a meal photo to Claude and returns its best guess at what it is and
 * how many calories it holds. The image is analyzed in memory and discarded —
 * nothing is stored, so the app needs no blob storage and no photo of the
 * user's food ever lives on a server.
 *
 * Returns an explicit failure rather than a guessed number: a wrong calorie
 * count presented as fact is worse than asking the user to type one.
 */
export async function analyzeMeal(formData: FormData): Promise<MealAnalysisResult> {
  await getCurrentUser();

  const file = formData.get("photo");
  if (!(file instanceof File)) return { ok: false, reason: "unsupported" };
  if (!ALLOWED_TYPES.includes(file.type as AllowedType)) return { ok: false, reason: "unsupported" };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, reason: "too_large" };

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const analysis = await analyzeMealPhoto(base64, file.type as AllowedType);
  if (!analysis) return { ok: false, reason: "unavailable" };
  return { ok: true, analysis };
}

/** Logs a meal against a day. Name and calories are whatever the user confirmed. */
export async function logMeal(input: {
  name: string;
  calories: number;
  dateInput: string;
  source: "photo" | "manual";
}): Promise<void> {
  const user = await getCurrentUser();

  const name = input.name.trim().slice(0, 80);
  if (!name) throw new Error("Give the meal a name.");
  if (!Number.isFinite(input.calories) || input.calories < 0 || input.calories > 10000) {
    throw new Error("Calories should be between 0 and 10,000.");
  }

  await prisma.meal.create({
    data: {
      userId: user.id,
      name,
      calories: Math.round(input.calories),
      date: parseLocalDateInput(input.dateInput),
      source: input.source === "photo" ? "photo" : "manual",
    },
  });
  revalidatePath("/calories");
  revalidatePath("/progress");
}

export async function deleteMeal(mealId: string): Promise<void> {
  const user = await getCurrentUser();
  await prisma.meal.deleteMany({ where: { id: mealId, userId: user.id } });
  revalidatePath("/calories");
  revalidatePath("/progress");
}

/** Sets the daily calorie goal (Profile > Goals). */
export async function setDailyCalorieTarget(target: number | null): Promise<void> {
  const user = await getCurrentUser();
  if (target != null && (!Number.isFinite(target) || target < 800 || target > 6000)) {
    throw new Error("Daily calorie goal should be between 800 and 6,000.");
  }
  await prisma.userPreferences.update({
    where: { userId: user.id },
    data: { dailyCalorieTarget: target == null ? null : Math.round(target) },
  });
  revalidatePath("/", "layout");
}
