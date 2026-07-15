export type GeneratedMilestone = {
  value: number;
  order: number;
};

function roundToNiceNumber(value: number): number {
  // Round to the nearest 5 — realistic plate/increment jumps for lb-based goals.
  return Math.round(value / 5) * 5;
}

/**
 * Generates realistic, non-evenly-spaced milestone checkpoints between a
 * goal's starting point and target. Steps land on round numbers rather than
 * exact fractions of the range, and the target itself is always the final
 * milestone.
 */
export function generateGoalMilestones(startingValue: number, targetValue: number): GeneratedMilestone[] {
  const range = targetValue - startingValue;
  if (range <= 0) return [{ value: targetValue, order: 0 }];

  // Aim for a checkpoint roughly every 15-25 units of progress, 3-6 total.
  const rawStepCount = Math.round(range / 20);
  const stepCount = Math.min(6, Math.max(3, rawStepCount));

  const milestones: number[] = [];
  for (let i = 1; i < stepCount; i++) {
    const raw = startingValue + (range * i) / stepCount;
    milestones.push(roundToNiceNumber(raw));
  }
  milestones.push(targetValue);

  // De-dupe and enforce strictly increasing (rounding can collide near the ends).
  const unique = Array.from(new Set(milestones))
    .filter((v) => v > startingValue && v <= targetValue)
    .sort((a, b) => a - b);

  if (unique[unique.length - 1] !== targetValue) unique.push(targetValue);

  return unique.map((value, index) => ({ value, order: index }));
}

/** Marks milestones achieved once the current best reaches or exceeds their value. */
export function updateMilestoneAchievements<T extends { value: number; achievedAt: Date | null }>(
  milestones: T[],
  currentBest: number,
  achievedOn: Date
): T[] {
  return milestones.map((m) =>
    m.achievedAt === null && currentBest >= m.value ? { ...m, achievedAt: achievedOn } : m
  );
}

export type GoalForecast = {
  estimatedWeeks: number;
  estimatedMonths: number;
} | null;

/**
 * Projects how long until a goal is reached using linear regression over
 * recent best-performance history. Returns null when there isn't enough
 * data or progress isn't trending toward the goal — per Alex's coaching
 * principles, say so rather than guessing.
 */
export function forecastGoalCompletion(
  targetValue: number,
  history: Array<{ date: Date; value: number }>,
  asOfDate: Date
): GoalForecast {
  if (history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sorted[0].date.getTime();
  const points = sorted.map((p) => ({
    x: (p.date.getTime() - firstDate) / (1000 * 60 * 60 * 24), // days since first point
    y: p.value,
  }));

  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slopePerDay = (n * sumXY - sumX * sumY) / denominator;
  if (slopePerDay <= 0) return null; // not trending toward the goal

  const latestValue = sorted[sorted.length - 1].value;
  const latestDaysFromStart = points[points.length - 1].x;
  const currentDaysFromStart = (asOfDate.getTime() - firstDate) / (1000 * 60 * 60 * 24);
  const remaining = targetValue - latestValue;
  if (remaining <= 0) return { estimatedWeeks: 0, estimatedMonths: 0 };

  const daysNeededFromLatestPoint = remaining / slopePerDay;
  const projectedDaysFromNow =
    latestDaysFromStart + daysNeededFromLatestPoint - currentDaysFromStart;

  const estimatedWeeks = Math.max(0, Math.round(projectedDaysFromNow / 7));
  const estimatedMonths = Math.max(0, Math.round(projectedDaysFromNow / 30.4));

  return { estimatedWeeks, estimatedMonths };
}
