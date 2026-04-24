"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVITY_BY_ID } from "@/lib/activities";
import { basePointsForLog, streakTierFor, type LoggedActivity } from "@/lib/scoring";
import { daysBetween } from "@/lib/date";

export type CheckInState = { error: string | null };

type ParsedLog = {
  activityId: string;
  durationMin: number | null;
  details: Record<string, string | number>;
};

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

/**
 * Server action used with useActionState.
 * Returns { error } on failure; throws (via redirect) on success.
 * Any thrown error is logged server-side and surfaced as a user-friendly message.
 */
export async function submitCheckIn(
  _prev: CheckInState,
  formData: FormData,
): Promise<CheckInState> {
  let redirectPath: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { error: "Your session has expired. Please log in again." };
    }

    const { localDate, note, logs } = parseForm(formData);

    if (!localDate) return { error: "Missing date." };
    if (logs.length === 0) return { error: "Select at least one activity." };

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("current_streak, longest_streak, total_points, last_checkin_date")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      console.error("[check-in] profile load failed", profileErr);
      return { error: "Couldn't load your profile." };
    }

    // ----- Streak logic -----
    let newStreak: number;
    const lastDate = profile.last_checkin_date as string | null;
    if (!lastDate) {
      newStreak = 1;
    } else if (lastDate === localDate) {
      newStreak = profile.current_streak ?? 1;
    } else {
      const gap = daysBetween(lastDate, localDate);
      if (gap === 1) newStreak = (profile.current_streak ?? 0) + 1;
      else if (gap <= 0) newStreak = profile.current_streak ?? 1;
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

    const { data: existing, error: existingErr } = await supabase
      .from("check_ins")
      .select("id, total_points")
      .eq("user_id", user.id)
      .eq("local_date", localDate)
      .maybeSingle();

    if (existingErr) {
      console.error("[check-in] existing lookup failed", existingErr);
      return { error: "Couldn't read your existing check-in." };
    }

    const oldTotal = existing?.total_points ?? 0;
    const pointsDelta = totalPoints - oldTotal;

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
      console.error("[check-in] upsert failed", checkInErr);
      return { error: "Couldn't save your check-in." };
    }

    const { error: delErr } = await supabase
      .from("activity_logs")
      .delete()
      .eq("check_in_id", checkIn.id);
    if (delErr) {
      console.error("[check-in] activity_logs delete failed", delErr);
      return { error: "Couldn't reset activity logs." };
    }

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
        console.error("[check-in] activity_logs insert failed", logsErr);
        return { error: "Couldn't save your activities." };
      }
    }

    const newTotalPoints = Math.max(0, (profile.total_points ?? 0) + pointsDelta);
    const newLongest = Math.max(profile.longest_streak ?? 0, newStreak);

    const { error: profileUpdErr } = await supabase
      .from("profiles")
      .update({
        total_points: newTotalPoints,
        current_streak: newStreak,
        longest_streak: newLongest,
        last_checkin_date: localDate,
      })
      .eq("id", user.id);

    if (profileUpdErr) {
      console.error("[check-in] profile update failed", profileUpdErr);
      return { error: "Saved your activities, but couldn't update your totals." };
    }

    revalidatePath("/", "layout");
    redirectPath = "/dashboard?checked_in=1";
  } catch (err) {
    console.error("[check-in] unexpected error", err);
    return { error: "Something went wrong. Please try again." };
  }

  // redirect() throws NEXT_REDIRECT — must be outside try/catch.
  if (redirectPath) redirect(redirectPath);
  return { error: null };
}
