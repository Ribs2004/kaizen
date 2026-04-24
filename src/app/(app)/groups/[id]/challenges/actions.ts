"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVITY_BY_ID } from "@/lib/activities";
import {
  computeChallengeReward,
  metricOptionsFor,
  type MetricType,
} from "@/lib/challenges";

export type CreateChallengeState = { error: string | null };

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function createChallengeAction(
  _prev: CreateChallengeState,
  formData: FormData,
): Promise<CreateChallengeState> {
  const groupId = String(formData.get("group_id") ?? "");
  let redirectPath: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return { error: "Your session has expired. Please log in again." };

    if (!groupId) return { error: "Missing group." };

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const rawActivityId = String(formData.get("activity_id") ?? "").trim();
    const activityId = rawActivityId === "" || rawActivityId === "__any__" ? null : rawActivityId;
    const metricType = String(formData.get("metric_type") ?? "") as MetricType;
    const rawDetailKey = String(formData.get("detail_key") ?? "").trim();
    const startsAt = String(formData.get("starts_at") ?? "");
    const endsAt = String(formData.get("ends_at") ?? "");

    if (!name) return { error: "Give the challenge a name." };
    if (name.length > 80) return { error: "Name is too long (80 char max)." };
    if (!isValidIsoDate(startsAt) || !isValidIsoDate(endsAt)) {
      return { error: "Pick valid start and end dates." };
    }
    if (endsAt < startsAt) return { error: "End date must be on or after start date." };

    // Validate activity + metric combination against the server-side allowlist.
    const options = metricOptionsFor(activityId);
    const matched = options.find(
      (o) =>
        o.type === metricType &&
        (metricType !== "sum_detail" || o.detailKey === (rawDetailKey || undefined)),
    );
    if (!matched) {
      return { error: "That metric isn't valid for the chosen activity." };
    }

    if (activityId && !ACTIVITY_BY_ID[activityId]) {
      return { error: "Unknown activity." };
    }

    const rewardPoints = computeChallengeReward({ startsAt, endsAt, activityId });

    const { data: challenge, error } = await supabase
      .from("challenges")
      .insert({
        group_id: groupId,
        created_by: user.id,
        name,
        description: description || null,
        activity_id: activityId,
        metric_type: metricType,
        detail_key: metricType === "sum_detail" ? rawDetailKey || null : null,
        unit: matched.unit || null,
        starts_at: startsAt,
        ends_at: endsAt,
        reward_points: rewardPoints,
      })
      .select("id")
      .single();

    if (error || !challenge) {
      console.error("[challenges] create failed", error);
      return { error: "Couldn't create the challenge." };
    }

    revalidatePath(`/groups/${groupId}`);
    revalidatePath(`/groups/${groupId}/admin`);
    redirectPath = `/groups/${groupId}/challenges/${challenge.id}`;
  } catch (err) {
    console.error("[challenges] create unexpected error", err);
    return { error: "Something went wrong. Please try again." };
  }

  if (redirectPath) redirect(redirectPath);
  return { error: null };
}

export async function deleteChallengeAction(formData: FormData): Promise<void> {
  const challengeId = String(formData.get("challenge_id") ?? "");
  const groupId = String(formData.get("group_id") ?? "");
  if (!challengeId || !groupId) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("challenges").delete().eq("id", challengeId);
  if (error) {
    console.error("[challenges] delete failed", error);
    redirect(
      `/groups/${groupId}/admin?error=${encodeURIComponent("Couldn't delete that challenge.")}`,
    );
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath(`/groups/${groupId}/admin`);
  redirect(`/groups/${groupId}/admin`);
}
