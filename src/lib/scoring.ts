import { ACTIVITY_BY_ID } from "./activities";

export type LoggedActivity = {
  activityId: string;
  durationMin?: number | null;
};

export type StreakTier = {
  days: number;
  multiplier: number;
  label: string;
};

export const STREAK_TIERS: StreakTier[] = [
  { days: 0,   multiplier: 1.0,  label: "Starter" },
  { days: 3,   multiplier: 1.1,  label: "Warming up" },
  { days: 7,   multiplier: 1.25, label: "On a roll" },
  { days: 14,  multiplier: 1.5,  label: "Locked in" },
  { days: 30,  multiplier: 2.0,  label: "Unstoppable" },
  { days: 60,  multiplier: 2.5,  label: "Relentless" },
  { days: 100, multiplier: 3.0,  label: "Legendary" },
];

export function streakTierFor(streakDays: number): StreakTier {
  let tier = STREAK_TIERS[0];
  for (const t of STREAK_TIERS) if (streakDays >= t.days) tier = t;
  return tier;
}

export function basePointsForLog(log: LoggedActivity): number {
  const activity = ACTIVITY_BY_ID[log.activityId];
  if (!activity) return 0;
  const duration = log.durationMin ?? 0;
  const durationBonus =
    activity.durationBonusPer10Min > 0 && duration > 0
      ? Math.floor(duration / 10) * activity.durationBonusPer10Min
      : 0;
  return activity.basePoints + durationBonus;
}

export type DayScore = {
  basePoints: number;
  multiplier: number;
  tier: StreakTier;
  totalPoints: number;
  logs: Array<{ activityId: string; points: number }>;
};

export function scoreDay(logs: LoggedActivity[], streakDaysIncludingToday: number): DayScore {
  const scoredLogs = logs.map((l) => ({ activityId: l.activityId, points: basePointsForLog(l) }));
  const basePoints = scoredLogs.reduce((sum, l) => sum + l.points, 0);
  const tier = streakTierFor(streakDaysIncludingToday);
  const totalPoints = Math.round(basePoints * tier.multiplier);
  return { basePoints, multiplier: tier.multiplier, tier, totalPoints, logs: scoredLogs };
}
