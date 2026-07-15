import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Model choice: these calls only phrase facts the rules engine already
// computed — no reasoning or math required — so a fast, inexpensive model is
// the right fit rather than a heavier one.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 300;

const ALEX_SYSTEM_PROMPT = `You are Alex, the user's personal AI fitness coach.
Your primary mission is to help the user enjoy working out and stay consistent long-term. Every response should support those goals.

Personality
- Be knowledgeable, friendly, and confident.
- Sound like an experienced personal trainer.
- Keep responses concise and conversational.
- Use light humor occasionally, including gently teasing the user when they've been slacking, but never shame or guilt them.
- Celebrate meaningful milestones and progress, not every workout.

Coaching Principles
- Prioritize consistency over perfection.
- Base your phrasing only on the facts provided to you in the prompt — never invent, estimate, or alter any number, date, exercise name, or statistic.
- Praise specific achievements instead of giving generic compliments.
- When you don't have enough information, say so rather than making assumptions.

Communication
- Keep explanations brief and practical.
- When explaining a recommendation, include a short reason why, using only the facts given.
- Offer one meaningful insight when relevant, framed to help the user recognize progress or identify an area for improvement.

Never
- Shame or guilt the user.
- Exaggerate results or make unrealistic promises.
- Overwhelm the user with unnecessary scientific detail.
- Be overly enthusiastic or use trendy slang.
- Invent any number, date, or fact not explicitly provided to you.`;

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function askAlex(userPrompt: string, fallback: string): Promise<string> {
  if (!client) return fallback;
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: ALEX_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    return text || fallback;
  } catch (error) {
    console.error("Alex AI call failed, using fallback copy:", error);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Workout Brief — shown before a weightlifting workout starts
// ---------------------------------------------------------------------------

export type WorkoutBriefFacts = {
  workoutTypeName: string;
  focus: string; // e.g. "progressing your squat while adding accessory variety"
  progressed: string[]; // exercise names being progressed this session
  held: string[]; // exercise names holding steady
  substitutions: Array<{ from: string; to: string }>;
};

export async function generateWorkoutBrief(facts: WorkoutBriefFacts): Promise<string> {
  const fallback = buildFallbackBrief(facts);
  const prompt = `Write a short (2-3 sentence) pre-workout brief for today's ${facts.workoutTypeName} session, in your voice as Alex.
Facts to use (do not add any other numbers or exercise names):
- Overall focus: ${facts.focus}
- Exercises being progressed: ${facts.progressed.join(", ") || "none"}
- Exercises holding steady: ${facts.held.join(", ") || "none"}
- Substitutions made: ${facts.substitutions.map((s) => `${s.from} replaced with ${s.to}`).join("; ") || "none"}
Return only the brief text, no preamble.`;
  return askAlex(prompt, fallback);
}

function buildFallbackBrief(facts: WorkoutBriefFacts): string {
  const parts = [`Today's focus: ${facts.focus}.`];
  if (facts.progressed.length) parts.push(`Progressing: ${facts.progressed.join(", ")}.`);
  if (facts.substitutions.length) {
    parts.push(
      facts.substitutions.map((s) => `${s.from} has been swapped for ${s.to} for variety.`).join(" ")
    );
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Workout Recap — shown after a workout is completed
// ---------------------------------------------------------------------------

export type WorkoutRecapFacts = {
  workoutTypeName: string;
  prsAchieved: string[]; // e.g. "Barbell Squat: new best of 150 lb"
  improvements: string[]; // e.g. "Barbell Hip Thrust up 5 lb from last session"
  totalVolumeLb: number | null;
  goalContext: string | null; // e.g. "supports your glute growth goal"
};

export async function generateWorkoutRecap(facts: WorkoutRecapFacts): Promise<string> {
  const fallback = buildFallbackRecap(facts);
  const prompt = `Write a short (2-3 sentence) post-workout recap for today's completed ${facts.workoutTypeName} session, in your voice as Alex. Feel like feedback from a knowledgeable personal trainer, not a generic success message.
Facts to use (do not add any other numbers or exercise names):
- PRs achieved: ${facts.prsAchieved.join(", ") || "none"}
- Improvements from last time: ${facts.improvements.join(", ") || "none"}
- Total working volume: ${facts.totalVolumeLb != null ? `${facts.totalVolumeLb} lb` : "not tracked"}
- Long-term goal context: ${facts.goalContext ?? "none"}
Return only the recap text, no preamble.`;
  return askAlex(prompt, fallback);
}

function capitalize(sentence: string): string {
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

function buildFallbackRecap(facts: WorkoutRecapFacts): string {
  const parts: string[] = [];
  if (facts.prsAchieved.length) parts.push(`New PR: ${facts.prsAchieved.join(", ")}.`);
  if (facts.improvements.length) parts.push(facts.improvements.join(". ") + ".");
  if (!parts.length) parts.push(`Nice work finishing your ${facts.workoutTypeName} session.`);
  if (facts.goalContext) parts.push(capitalize(facts.goalContext) + ".");
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Home Page insight — one factual, encouraging insight based on trends
// ---------------------------------------------------------------------------

export type HomeInsightFacts = {
  insightType: string; // short label describing what kind of fact this is
  fact: string; // the exact factual statement to phrase, e.g. "completed 85% of planned workouts over the past 6 months"
};

export async function generateHomeInsight(facts: HomeInsightFacts): Promise<string> {
  const fallback = `${facts.fact.charAt(0).toUpperCase()}${facts.fact.slice(1)}.`;
  const prompt = `Phrase this single fact as one encouraging, personalized sentence in your voice as Alex. Do not add any other numbers or claims, and avoid generic motivational language.
Fact: ${facts.fact}
Return only the sentence, no preamble.`;
  return askAlex(prompt, fallback);
}

// ---------------------------------------------------------------------------
// Recommendation reason — why today's workout was chosen (Home/Calendar)
// ---------------------------------------------------------------------------

export async function generateRecommendationReason(
  workoutTypeName: string,
  engineReason: string
): Promise<string> {
  const prompt = `Rephrase this workout recommendation reason in your voice as Alex, in 1-2 sentences. Do not add any numbers or facts beyond what's given.
Workout: ${workoutTypeName}
Reason: ${engineReason}
Return only the rephrased reason, no preamble.`;
  return askAlex(prompt, engineReason);
}

// ---------------------------------------------------------------------------
// Goal suggestion — natural-language goal creation ("I want bigger glutes")
// ---------------------------------------------------------------------------

export type GoalSuggestionContext = {
  userRequest: string;
  topPriorityCategory: string | null;
  candidateExercises: string[]; // exercise names available to suggest from
};

export async function interpretGoalRequest(
  context: GoalSuggestionContext
): Promise<{ exerciseName: string | null; explanation: string }> {
  if (!client) {
    return {
      exerciseName: context.candidateExercises[0] ?? null,
      explanation:
        "Based on your request, here's a goal to consider — feel free to customize the exercise or target.",
    };
  }
  const prompt = `The user described a fitness goal in their own words: "${context.userRequest}".
Their top training priority is: ${context.topPriorityCategory ?? "not set"}.
Choose the single best-matching exercise from this exact list (respond with the exact name from the list, or "none" if nothing fits): ${context.candidateExercises.join(", ")}.
Then write a 1-sentence explanation of why, in your voice as Alex.
Respond in exactly this format:
EXERCISE: <exact exercise name or none>
EXPLANATION: <one sentence>`;
  const fallback = `EXERCISE: ${context.candidateExercises[0] ?? "none"}\nEXPLANATION: Based on your request, here's a goal to consider — feel free to customize the exercise or target.`;
  const result = await askAlex(prompt, fallback);

  const exerciseMatch = result.match(/EXERCISE:\s*(.+)/i);
  const explanationMatch = result.match(/EXPLANATION:\s*(.+)/i);
  const exerciseName = exerciseMatch?.[1]?.trim();

  return {
    exerciseName: exerciseName && exerciseName.toLowerCase() !== "none" ? exerciseName : null,
    explanation:
      explanationMatch?.[1]?.trim() ??
      "Based on your request, here's a goal to consider — feel free to customize the exercise or target.",
  };
}
