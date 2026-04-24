import { ACTIVITIES, ACTIVITY_BY_ID, type Activity, type DetailField } from "@/lib/activities";

export type MetricType =
  | "count_days"
  | "sum_duration_min"
  | "sum_detail"
  | "sum_points"
  | "active_days";

export const METRIC_LABELS: Record<MetricType, string> = {
  count_days: "Days done",
  sum_duration_min: "Total minutes",
  sum_detail: "Total",
  sum_points: "Total points",
  active_days: "Active days",
};

export const METRIC_UNITS: Record<Exclude<MetricType, "sum_detail">, string> = {
  count_days: "days",
  sum_duration_min: "min",
  sum_points: "pts",
  active_days: "days",
};

export type MetricOption = {
  type: MetricType;
  detailKey?: string;
  label: string;
  unit: string;
};

/** Metric options available for a given activity (or the "any" scope). */
export function metricOptionsFor(activityId: string | null): MetricOption[] {
  if (!activityId) {
    return [{ type: "active_days", label: "Active days", unit: "days" }];
  }
  const activity = ACTIVITY_BY_ID[activityId];
  if (!activity) return [];

  const options: MetricOption[] = [
    { type: "count_days", label: `Days ${activity.name.toLowerCase()}`, unit: "days" },
    { type: "sum_points", label: "Total points earned", unit: "pts" },
  ];

  const hasDurationDetail = activity.details.some((d) => d.kind === "duration");
  if (hasDurationDetail) {
    options.push({ type: "sum_duration_min", label: "Total minutes", unit: "min" });
  }

  for (const detail of activity.details) {
    if (detail.kind === "number") {
      options.push({
        type: "sum_detail",
        detailKey: detail.key,
        label: `Total ${detail.label.toLowerCase()}`,
        unit: detail.unit ?? "",
      });
    }
  }

  return options;
}

/** Activities that support at least one numeric challenge metric. */
export function challengeableActivities(): Activity[] {
  return ACTIVITIES;
}

/** Find the detail field on an activity by key, for labeling. */
export function detailField(
  activityId: string | null,
  detailKey: string | null,
): DetailField | null {
  if (!activityId || !detailKey) return null;
  return ACTIVITY_BY_ID[activityId]?.details.find((d) => d.key === detailKey) ?? null;
}

// ---------------------------------------------------------------
// Reward algorithm
// ---------------------------------------------------------------
//   duration_days   = ends_at - starts_at + 1
//   duration_factor = clamp(duration_days / 7, min 1, max 4)
//   activity_factor = activity.basePoints / 5  (habits = 1, exercises = 2)
//                     (or 1.5 for active_days with no activity)
//   reward          = round(50 * duration_factor * activity_factor)
// ---------------------------------------------------------------
export function computeChallengeReward(args: {
  startsAt: string;
  endsAt: string;
  activityId: string | null;
}): number {
  const days = Math.max(1, daysInclusive(args.startsAt, args.endsAt));
  const durationFactor = Math.min(4, Math.max(1, days / 7));

  let activityFactor = 1.5;
  if (args.activityId) {
    const activity = ACTIVITY_BY_ID[args.activityId];
    if (activity) activityFactor = activity.basePoints / 5;
  }

  return Math.round(50 * durationFactor * activityFactor);
}

function daysInclusive(startIso: string, endIso: string): number {
  const start = Date.UTC(...parseIso(startIso));
  const end = Date.UTC(...parseIso(endIso));
  return Math.round((end - start) / 86_400_000) + 1;
}

function parseIso(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}

// ---------------------------------------------------------------
// Leaderboard computation (for display; SQL finalize is the source
// of truth for awarding).
// ---------------------------------------------------------------
export type LogRow = {
  user_id: string;
  local_date: string;
  activity_id: string;
  points: number;
  duration_min: number | null;
  details: Record<string, string | number>;
};

export type ChallengeForLeaderboard = {
  activity_id: string | null;
  metric_type: MetricType;
  detail_key: string | null;
  starts_at: string;
  ends_at: string;
};

export type ScoredEntry = { userId: string; metric: number };

export function computeLeaderboard(
  challenge: ChallengeForLeaderboard,
  logs: LogRow[],
  participantIds: string[],
): ScoredEntry[] {
  const inWindow = logs.filter(
    (l) =>
      l.local_date >= challenge.starts_at &&
      l.local_date <= challenge.ends_at &&
      (challenge.activity_id === null || l.activity_id === challenge.activity_id),
  );

  const scores = new Map<string, number>();
  for (const id of participantIds) scores.set(id, 0);

  const datesByUser = new Map<string, Set<string>>();

  for (const log of inWindow) {
    switch (challenge.metric_type) {
      case "count_days":
      case "active_days": {
        const set = datesByUser.get(log.user_id) ?? new Set<string>();
        set.add(log.local_date);
        datesByUser.set(log.user_id, set);
        break;
      }
      case "sum_duration_min": {
        const prev = scores.get(log.user_id) ?? 0;
        scores.set(log.user_id, prev + (log.duration_min ?? 0));
        break;
      }
      case "sum_points": {
        const prev = scores.get(log.user_id) ?? 0;
        scores.set(log.user_id, prev + (log.points ?? 0));
        break;
      }
      case "sum_detail": {
        if (!challenge.detail_key) break;
        const raw = log.details?.[challenge.detail_key];
        const num = typeof raw === "number" ? raw : Number(raw);
        if (Number.isFinite(num)) {
          const prev = scores.get(log.user_id) ?? 0;
          scores.set(log.user_id, prev + num);
        }
        break;
      }
    }
  }

  if (challenge.metric_type === "count_days" || challenge.metric_type === "active_days") {
    for (const [uid, dates] of datesByUser.entries()) scores.set(uid, dates.size);
  }

  return [...scores.entries()]
    .map(([userId, metric]) => ({ userId, metric }))
    .sort((a, b) => b.metric - a.metric || a.userId.localeCompare(b.userId));
}

export function metricDisplayUnit(
  metricType: MetricType,
  detailField: DetailField | null,
): string {
  if (metricType === "sum_detail") return detailField?.unit ?? "";
  return METRIC_UNITS[metricType];
}

export function challengeStatus(
  startsAt: string,
  endsAt: string,
  finalizedAt: string | null,
): "upcoming" | "active" | "ended" | "finalized" {
  if (finalizedAt) return "finalized";
  const today = todayIso();
  if (today < startsAt) return "upcoming";
  if (today > endsAt) return "ended";
  return "active";
}

export function todayIso(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
