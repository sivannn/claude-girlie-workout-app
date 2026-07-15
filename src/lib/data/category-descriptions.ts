import type { TrainingCategory } from "@/lib/types/enums";

export const CATEGORY_NAME: Record<TrainingCategory, string> = {
  glutes_legs: "Glutes & Legs",
  chest_triceps: "Chest & Triceps",
  back_biceps: "Back & Biceps",
  abs: "Abs",
  cardio: "Cardio",
};

export const CATEGORY_DESCRIPTION: Record<TrainingCategory, string> = {
  glutes_legs:
    "Building stronger glutes and legs supports muscle growth, lower body strength, and overall athletic development.",
  chest_triceps:
    "Progressing your pressing strength builds upper body muscle and supports balanced, full-body development.",
  back_biceps:
    "A strong back and pulling strength protect your posture and balance out your pressing work.",
  abs: "A stronger core supports better performance and stability across every other lift.",
  cardio: "Steady cardio progress builds endurance and supports long-term heart health alongside your strength work.",
};
