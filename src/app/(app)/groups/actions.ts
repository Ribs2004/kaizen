"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateGroupState = { error: string | null };
export type JoinGroupState = { error: string | null };

export async function createGroupAction(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  let redirectPath: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return { error: "Your session has expired. Please log in again." };

    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();

    if (!name) return { error: "Give the group a name." };
    if (name.length > 60) return { error: "Name is too long (60 char max)." };

    const { data: group, error } = await supabase
      .from("groups")
      .insert({
        name,
        description: description || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error || !group) {
      console.error("[groups] create failed", error);
      return { error: "Couldn't create the group." };
    }

    revalidatePath("/groups", "layout");
    redirectPath = `/groups/${group.id}`;
  } catch (err) {
    console.error("[groups] create unexpected error", err);
    return { error: "Something went wrong. Please try again." };
  }

  if (redirectPath) redirect(redirectPath);
  return { error: null };
}

export async function joinGroupAction(
  _prev: JoinGroupState,
  formData: FormData,
): Promise<JoinGroupState> {
  let redirectPath: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return { error: "Your session has expired. Please log in again." };

    const inviteCode = String(formData.get("invite_code") ?? "").trim();
    if (!inviteCode) return { error: "Missing invite code." };

    const { data: group, error: groupErr } = await supabase
      .from("groups")
      .select("id")
      .eq("invite_code", inviteCode)
      .maybeSingle();

    if (groupErr) {
      console.error("[groups] join lookup failed", groupErr);
      return { error: "Couldn't find that invite." };
    }
    if (!group) return { error: "Invite link is invalid or expired." };

    const { error: insertErr } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "member" });

    // Ignore unique violation — already a member.
    if (insertErr && insertErr.code !== "23505") {
      console.error("[groups] join insert failed", insertErr);
      return { error: "Couldn't join the group." };
    }

    revalidatePath("/groups", "layout");
    redirectPath = `/groups/${group.id}`;
  } catch (err) {
    console.error("[groups] join unexpected error", err);
    return { error: "Something went wrong. Please try again." };
  }

  if (redirectPath) redirect(redirectPath);
  return { error: null };
}

export async function leaveGroupAction(formData: FormData): Promise<void> {
  const groupId = String(formData.get("group_id") ?? "");
  if (!groupId) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    console.error("[groups] leave failed", error);
    redirect(`/groups/${groupId}?error=${encodeURIComponent("Couldn't leave the group.")}`);
  }

  revalidatePath("/groups", "layout");
  redirect("/groups");
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const groupId = String(formData.get("group_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!groupId || !userId) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Never let an owner remove themselves via this action.
  if (userId === user.id) {
    redirect(`/groups/${groupId}?error=${encodeURIComponent("Use 'Leave group' to exit as owner.")}`);
  }

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);

  if (error) {
    console.error("[groups] remove member failed", error);
    redirect(`/groups/${groupId}?error=${encodeURIComponent("Couldn't remove that member.")}`);
  }

  revalidatePath(`/groups/${groupId}`);
  redirect(`/groups/${groupId}`);
}
