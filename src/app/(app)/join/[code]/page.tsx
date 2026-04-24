import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { JoinGroupForm } from "./join-group-form";

export const metadata = { title: "Join group" };

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, invite_code")
    .eq("invite_code", code)
    .maybeSingle();

  if (!group) {
    return (
      <div className="fade-up mx-auto max-w-md text-center">
        <div className="card-elevated p-10">
          <div className="mx-auto mb-3 text-4xl">🚫</div>
          <h1 className="text-lg font-semibold">Invite not found</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            This link is invalid or has expired. Ask the group owner for a fresh one.
          </p>
          <Link
            href="/groups"
            className="mt-5 inline-flex rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white"
          >
            Back to groups
          </Link>
        </div>
      </div>
    );
  }

  // Already a member? Send straight through.
  if (user) {
    const { data: existing } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) redirect(`/groups/${group.id}`);
  }

  const { count: memberCount } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", group.id);

  return (
    <div className="fade-up mx-auto max-w-md space-y-5">
      <div className="card-elevated relative overflow-hidden p-6 text-center">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] opacity-20 blur-2xl" />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] text-2xl text-white">
            👥
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
            You're invited to
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{group.name}</h1>
          {group.description && (
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">{group.description}</p>
          )}
          <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
            {memberCount ?? 0} member{(memberCount ?? 0) === 1 ? "" : "s"} already in
          </p>
        </div>
      </div>

      <JoinGroupForm inviteCode={group.invite_code} />

      <Link
        href="/groups"
        className="block text-center text-xs text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
      >
        Not now
      </Link>
    </div>
  );
}
