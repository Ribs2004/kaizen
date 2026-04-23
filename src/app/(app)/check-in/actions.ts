"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVITY_BY_ID } from "@/lib/activities";
import { basePointsForLog, streakTierFor, type LoggedActivity } from "@/lib/scoring";
import { daysBetween } from "@/lib/date";

type ParsedLog = {
  activityId: string;
  durationMin: number | null;
  details: Record<string, string | number>;
};

/**
 * FormData shape:
 *   local_date: "YYYY-MM-DD"
 *   activity_ids: repeated field with each selected activity id
 *   detail_{activityId}_{key}: optional string value
 *   note: optional free-text note
 */
function parseForm(formData: FormData): { localDate: string; note: string; logs: ParsedLog[] } {
  const localDate = String(formData.get("local_date") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const activityIds = formData.getAll("activity_ids").map(String).filter(Boolean);

  const logs: ParsedLog[] = [];
  for (const id of activityIds) {
    const activity = ACTIVITY_BY_ID[id];
    if (!activity) continue;

    const details: Record<string, string | number> = {};
    let durationMin: number | null = null;

    for (const field of activity.details) {
      const raw = formData.get(`detail_${id}_${field.key}`);
      if (raw == null || raw === "") continue;
      const str = String(raw).trim();
      if (!str) continue;

      if (field.kind === "number" || field.kind === "duration") {
        const num = Number(str);
        if (Number.isFinite(num)) {
          details[field.key] = num;
          if (field.kind === "duration") durationMin = num;
        }
      } else {
        details[field.key] = str;
      }
    }

    logs.push({ activityId: id, durationMin, details });
  }

  return { localDate, note, logs };
}

export async function submitCheckIn(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { localDate, note, logs } = parseForm(formData);

  if (!localDate) {
    redirect("/check-in?error=" + encodeURIComponent("Missing date."));
  }
  if (logs.length === 0) {
    redirect("/check-in?error=" + encodeURIComponent("Select at least one activity."));
  }

  // Load profile (for streak & total points).
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("current_streak, longest_streak, total_points, last_checkin_date")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    redirect("/check-in?error=" + encodeURIComponent("Couldn't load your profile."));
  }

  // ----- Streak logic -----
  let newStreak: number;
  const lastDate = profile.last_checkin_date as string | null;
  if (!lastDate) {
    newStreak = 1;
  } else if (lastDate === localDate) {
    // Editing today's check-in — keep streak as-is.
    newStreak = profile.current_streak ?? 1;
  } else {
    const gap = daysBetween(lastDate, localDate);
    if (gap === 1) newStreak = (profile.current_streak ?? 0) + 1;
    else if (gap <= 0) newStreak = profile.current_streak ?? 1; // out-of-order: don't reset
    else newStreak = 1;
  }
  const tier = streakTierFor(newStreak);

  // ----- Points -----
  const scoredLogs = logs.map((l) => {
    const input: LoggedActivity = { activityId: l.activityId, durationMin: l.durationMin };
    return { ...l, points: basePointsForLog(input) };
  });
  const basePoints = scoredLogs.reduce((sum, l) => sum + l.points, 0);
  const totalPoints = Math.round(basePoints * tier.multiplier);

  // ----- Existing check-in (for point delta) -----
  const { data: existing } = await supabase
    .from("check_ins")
    .select("id, total_points")
    .eq("user_id", user.id)
    .eq("local_date", localDate)
    .maybeSingle();

  const oldTotal = existing?.total_points ?? 0;
  const pointsDelta = totalPoints - oldTotal;

  // ----- Upsert check-in -----
  const { data: checkIn, error: checkInErr } = await supabase
    .from("check_ins")
    .upsert(
      {
        ...(existing?.id ? { id: existing.id } : {}),
        user_id: user.id,
        local_date: localDate,
        base_points: basePoints,
        multiplier: tier.multiplier,
        total_points: totalPoints,
        streak_days: newStreak,
        note: note || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,local_date" },
    )
    .select("id")
    .single();

  if (checkInErr || !checkIn) {
    console.error("check_ins upsert failed", checkInErr);
    redirect("/check-in?error=" + encodeURIComponent("Couldn't save your check-in."));
  }

  // ----- Replace activity logs for this check-in -----
  await supabase.from("activity_logs").delete().eq("check_in_id", checkIn.id);

  if (scoredLogs.length > 0) {
    const rows = scoredLogs.map((l) => ({
      check_in_id: checkIn.id,
      user_id: user.id,
      activity_id: l.activityId,
      points: l.points,
      duration_min: l.durationMin,
      details: l.details,
    }));
    const { error: logsErr } = await supabase.from("activity_logs").insert(rows);
    if (logsErr) {
      console.error("activity_logs insert failed", logsErr);
      redirect("/check-in?error=" + encodeURIComponent("Couldn't save your activities."));
    }
  }

  // ----- Update profile aggregates -----
  const newTotalPoints = Math.max(0, (profile.total_points ?? 0) + pointsDelta);
  const newLongest = Math.max(profile.longest_streak ?? 0, newStreak);

  await supabase
    .from("profiles")
    .update({
      total_points: newTotalPoints,
      current_streak: newStreak,
      longest_streak: newLongest,
      last_checkin_date: localDate,
    })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/dashboard?checked_in=1");
}
