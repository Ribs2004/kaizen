import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { challengeStatus } from "@/lib/challenges";
import { ACTIVITY_BY_ID } from "@/lib/activities";
import { deleteChallengeAction } from "../challenges/actions";
import { NewChallengeForm } from "./new-challenge-form";

export const metadata = { title: "Manage group" };

export default async function GroupAdminPage({
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
  if (!user) redirect(`/login?next=/groups/${id}/admin`);

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: myMembership } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (myMembership?.role !== "owner") {
    redirect(`/groups/${id}?error=${encodeURIComponent("Only the owner can manage the group.")}`);
  }

  // Auto-finalize any expired challenges so the admin view is up to date.
  await supabase.rpc("finalize_group_challenges", { gid: id });

  const { data: challenges } = await supabase
    .from("challenges")
    .select(
      "id, name, activity_id, metric_type, unit, starts_at, ends_at, reward_points, finalized_at, winner_id",
    )
    .eq("group_id", id)
    .order("ends_at", { ascending: false });

  return (
    <div className="fade-up space-y-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-xs text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          ← Back to group
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Manage — {group.name}</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          Create challenges. Winners get points in their journey and in the group ranking.
        </p>
      </div>

      {flashError && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {flashError}
        </div>
      )}

      <section className="card-elevated p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">New challenge</h2>
        <div className="mt-4">
          <NewChallengeForm groupId={id} />
        </div>
      </section>

      <section className="card-elevated p-5">
        <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">All challenges</h2>
        <div className="mt-3">
          {!challenges || challenges.length === 0 ? (
            <p className="text-sm text-[var(--foreground-muted)]">No challenges yet.</p>
          ) : (
            <ul className="space-y-2">
              {challenges.map((c) => {
                const status = challengeStatus(c.starts_at, c.ends_at, c.finalized_at);
                const activity = c.activity_id ? ACTIVITY_BY_ID[c.activity_id] : null;
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2.5"
                  >
                    <span className="text-lg leading-none">{activity?.emoji ?? "🏆"}</span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/groups/${id}/challenges/${c.id}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--foreground-muted)]">
                        <StatusPill status={status} />
                        <span>
                          {c.starts_at} → {c.ends_at}
                        </span>
                        <span className="text-[var(--foreground-subtle)]">·</span>
                        <span>{c.reward_points} pts reward</span>
                      </div>
                    </div>
                    <form action={deleteChallengeAction}>
                      <input type="hidden" name="challenge_id" value={c.id} />
                      <input type="hidden" name="group_id" value={id} />
                      <button
                        type="submit"
                        title="Delete challenge"
                        className="rounded-md border border-[var(--border)] px-2 py-1 text-[10px] text-[var(--foreground-muted)] transition hover:border-[var(--danger)]/50 hover:text-[var(--danger)]"
                      >
                        Delete
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "upcoming" | "active" | "ended" | "finalized";
}) {
  const styles: Record<typeof status, { bg: string; fg: string; label: string }> = {
    upcoming: {
      bg: "var(--accent-cyan)",
      fg: "#05343c",
      label: "Upcoming",
    },
    active: {
      bg: "var(--success)",
      fg: "#052914",
      label: "Active",
    },
    ended: {
      bg: "var(--warning)",
      fg: "#3d2800",
      label: "Ended",
    },
    finalized: {
      bg: "var(--primary)",
      fg: "#ffffff",
      label: "Finalized",
    },
  };
  const s = styles[status];
  return (
    <span
      className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}
