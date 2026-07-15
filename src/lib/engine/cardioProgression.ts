export type CardioSession = {
  date: Date;
  timeSeconds: number | null;
  distanceMiles: number | null;
};

export type CardioRecommendation = {
  recommendedDistanceMiles: number | null;
  recommendedTimeSeconds: number | null;
  reason: string;
};

function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Cardio progression per the Workout Playbook: gradually improve distance or
 * pace based on previous performance, alternating focus so pace work and
 * distance work both get attention over time (matching "progress either
 * distance or pace depending on previous performance").
 */
export function decideCardioProgression(
  recentSessions: CardioSession[]
): CardioRecommendation {
  if (recentSessions.length === 0) {
    return {
      recommendedDistanceMiles: null,
      recommendedTimeSeconds: null,
      reason: "First time logging this one — log today's effort and I'll use it as your baseline.",
    };
  }

  const [last] = recentSessions;
  const progressDistance = recentSessions.length % 2 === 1; // alternate focus session to session

  if (last.distanceMiles != null && progressDistance) {
    const nextDistance = roundToQuarter(last.distanceMiles * 1.08);
    return {
      recommendedDistanceMiles: nextDistance,
      recommendedTimeSeconds: null,
      reason: `Last time you covered ${last.distanceMiles} mi — today's target is ${nextDistance} mi at a similar effort.`,
    };
  }

  if (last.timeSeconds != null && last.distanceMiles != null) {
    const paceSecondsPerMile = last.timeSeconds / last.distanceMiles;
    const targetTime = Math.round(last.distanceMiles * paceSecondsPerMile * 0.98);
    return {
      recommendedDistanceMiles: last.distanceMiles,
      recommendedTimeSeconds: targetTime,
      reason: `Same ${last.distanceMiles} mi distance as last time — aim to shave a little off your time.`,
    };
  }

  if (last.distanceMiles != null) {
    const nextDistance = roundToQuarter(last.distanceMiles * 1.05);
    return {
      recommendedDistanceMiles: nextDistance,
      recommendedTimeSeconds: null,
      reason: `Building gradually from last time's ${last.distanceMiles} mi.`,
    };
  }

  return {
    recommendedDistanceMiles: null,
    recommendedTimeSeconds: last.timeSeconds,
    reason: "Keeping today's target time similar to last time — log your actual effort.",
  };
}
