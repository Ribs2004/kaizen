import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { beltProgressFor } from "@/lib/belts";
import { leaveGroupAction, removeMemberAction } from "../actions";
import { CopyInviteButton } from "./copy-invite-button";

export const metadata = { title: "Group" };

type ProfileSlim = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_emoji: string | null;
  total_points: number;
  current_streak: number;
};

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  profiles: ProfileSlim | ProfileSlim[] | null;
};

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: flashError } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, invite_code, created_by")
    .eq("id", id)
    .maybeSingle();

  if (!group) notFound();

  const { data: membersRaw } = await supabase
    .from("group_members")
    .select(
      "user_id, role, joined_at, profiles(id, username, display_name, avatar_emoji, total_points, current_streak)",
    )
    .eq("group_id", id)
    .order("joined_at", { ascending: true });

  const members = (membersRaw ?? [])
    .map((m) => {
      const raw = m as MemberRow;
      const profile = Array.isArray(raw.profiles) ? raw.profiles[0] : raw.profiles;
      return profile
        ? {
            userId: raw.user_id,
            role: raw.role,
            joinedAt: raw.joined_at,
            profile,
          }
        : null;
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  const isMember = !!user && members.some((m) => m.userId === user.id);
  const myRole = user ? members.find((m) => m.userId === user.id)?.role : undefined;
  const isOwner = myRole === "owner";

  const leaderboard = [...members].sort(
    (a, b) => (b.profile.total_points ?? 0) - (a.profile.total_points ?? 0),
  );

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteUrl = `${origin}/join/${group.invite_code}`;

  return (
    <div className="fade-up space-y-6">
      <div>
        <Link
          href="/groups"
          className="text-xs text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          ← Back to groups
        </Link>
      </div>

      {flashError && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {flashError}
        </div>
      )}

      <header className="card-elevated relative overflow-hidden p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] opacity-20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
            {group.description && (
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">{group.description}</p>
            )}
            <p className="mt-3 text-xs text-[var(--foreground-subtle)]">
              {members.length} member{members.length === 1 ? "" : "s"}
              {isOwner && " · you're the owner"}
            </p>
          </div>
        </div>
      </header>

      {isMember && (
        <section className="card-elevated p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">Invite link</h2>
          <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
            Share this with anyone you want in the group.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-xs text-[var(--foreground)]">
              {inviteUrl || `/join/${group.invite_code}`}
            </code>
            <CopyInviteButton value={inviteUrl || `/join/${group.invite_code}`} />
          </div>
        </section>
      )}

      <section className="card-elevated p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">
            All-time leaderboard
          </h2>
          <span className="text-[10px] uppercase tracking-wide text-[var(--foreground-subtle)]">
            By total points
          </span>
        </div>
        <ol className="space-y-2">
          {leaderboard.map((m, i) => {
            const belt = beltProgressFor(m.profile.total_points ?? 0);
            const isYou = m.userId === user?.id;
            const rank = i + 1;
            return (
              <li
                key={m.userId}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2.5"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    rank === 1
                      ? "bg-[var(--warning)] text-black"
                      : rank === 2
                        ? "bg-[var(--foreground-muted)] text-black"
                        : rank === 3
                          ? "bg-[var(--accent-orange)] text-black"
                          : "bg-[var(--surface)] text-[var(--foreground-muted)]"
                  }`}
                >
                  {rank}
                </span>
                <span className="text-lg leading-none">{m.profile.avatar_emoji ?? "🥋"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {m.profile.display_name ?? m.profile.username}
                      {isYou && (
                        <span className="ml-1.5 text-[10px] font-semibold text-[var(--primary)]">
                          YOU
                        </span>
                      )}
                    </span>
                    {m.role === "owner" && (
                      <span className="rounded-full bg-[var(--primary)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--foreground-muted)]">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: belt.current.color }}
                    />
                    <span>{belt.current.name}</span>
                    <span className="text-[var(--foreground-subtle)]">·</span>
                    <span>🔥 {m.profile.current_streak ?? 0}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">
                    {(m.profile.total_points ?? 0).toLocaleString()}
                  </div>
                  <div className="text-[10px] text-[var(--foreground-subtle)]">pts</div>
                </div>
                {isOwner && !isYou && (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="group_id" value={group.id} />
                    <input type="hidden" name="user_id" value={m.userId} />
                    <button
                      type="submit"
                      title="Remove member"
                      className="ml-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground-muted)] transition hover:border-[var(--danger)]/50 hover:text-[var(--danger)]"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {isMember && (
        <section className="card-elevated p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">Danger zone</h2>
          <p className="mt-1 text-xs text-[var(--foreground-subtle)]">
            {isOwner
              ? "If you leave as the owner, ownership needs to be reassigned (coming soon)."
              : "You can rejoin anytime with the invite link."}
          </p>
          <form action={leaveGroupAction} className="mt-3">
            <input type="hidden" name="group_id" value={group.id} />
            <button
              type="submit"
              className="rounded-full border border-[var(--danger)]/40 bg-transparent px-4 py-2 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
            >
              Leave group
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
