import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVITY_BY_ID } from "@/lib/activities";
import {
  challengeStatus,
  computeLeaderboard,
  detailField,
  metricDisplayUnit,
  type LogRow,
  type MetricType,
} from "@/lib/challenges";

export const metadata = { title: "Challenge" };

type ChallengeRow = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  activity_id: string | null;
  metric_type: MetricType;
  detail_key: string | null;
  unit: string | null;
  starts_at: string;
  ends_at: string;
  reward_points: number;
  finalized_at: string | null;
  winner_id: string | null;
};

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/groups/${id}/challenges/${cid}`);

  // Auto-finalize if the deadline has passed.
  await supabase.rpc("finalize_challenge", { cid });

  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, group_id, name, description, activity_id, metric_type, detail_key, unit, starts_at, ends_at, reward_points, finalized_at, winner_id",
    )
    .eq("id", cid)
    .maybeSingle();

  if (!challenge || challenge.group_id !== id) notFound();
  const c = challenge as ChallengeRow;

  const { data: group } = await supabase
    .from("groups")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!group) notFound();

  const { data: members } = await supabase
    .from("group_members")
    .select("user_id, profiles(id, username, display_name, avatar_emoji)")
    .eq("group_id", id);

  type MemberProfile = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_emoji: string | null;
  };
  const memberProfiles = (members ?? [])
    .map((m) => {
      const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return p as MemberProfile | null;
    })
    .filter((p): p is MemberProfile => !!p);

  const participantIds = memberProfiles.map((p) => p.id);

  // Load logs inside the challenge window for those participants.
  const { data: checkInsInWindow } = await supabase
    .from("check_ins")
    .select("id, user_id, local_date")
    .in("user_id", participantIds.length ? participantIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("local_date", c.starts_at)
    .lte("local_date", c.ends_at);

  const checkInById = new Map<string, { user_id: string; local_date: string }>();
  for (const row of checkInsInWindow ?? []) {
    checkInById.set(row.id as string, {
      user_id: row.user_id as string,
      local_date: row.local_date as string,
    });
  }

  const checkInIds = [...checkInById.keys()];
  let logs: LogRow[] = [];
  if (checkInIds.length > 0) {
    const { data: logRows } = await supabase
      .from("activity_logs")
      .select("check_in_id, user_id, activity_id, points, duration_min, details")
      .in("check_in_id", checkInIds);

    logs = (logRows ?? []).map((r) => {
      const meta = checkInById.get(r.check_in_id as string);
      return {
        user_id: r.user_id as string,
        local_date: meta?.local_date ?? "",
        activity_id: r.activity_id as string,
        points: (r.points as number) ?? 0,
        duration_min: (r.duration_min as number | null) ?? null,
        details: (r.details as Record<string, string | number>) ?? {},
      };
    });
  }

  const scored = computeLeaderboard(
    {
      activity_id: c.activity_id,
      metric_type: c.metric_type,
      detail_key: c.detail_key,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
    },
    logs,
    participantIds,
  );

  const status = challengeStatus(c.starts_at, c.ends_at, c.finalized_at);
  const activity = c.activity_id ? ACTIVITY_BY_ID[c.activity_id] : null;
  const field = detailField(c.activity_id, c.detail_key);
  const unit = c.unit ?? metricDisplayUnit(c.metric_type, field);

  const profileById = new Map(memberProfiles.map((p) => [p.id, p]));
  const winner = c.winner_id ? profileById.get(c.winner_id) : null;

  return (
    <div className="fade-up space-y-6">
      <div>
        <Link
          href={`/groups/${id}`}
          className="text-xs text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          ← Back to {group.name}
        </Link>
      </div>

      <header className="card-elevated relative overflow-hidden p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#ff7a45] to-[#facc15] opacity-20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
            <StatusPill status={status} />
            <span>
              {c.starts_at} → {c.ends_at}
            </span>
          </div>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <span>{activity?.emoji ?? "🏆"}</span>
            <span>{c.name}</span>
          </h1>
          {c.description && (
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">{c.description}</p>
          )}
          <p className="mt-3 text-xs text-[var(--foreground-muted)]">
            Measured by <span className="font-medium">{metricLabel(c, field?.label ?? null)}</span>{" "}
            · Reward{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {c.reward_points} pts
            </span>{" "}
            to the winner
          </p>
        </div>
      </header>

      {status === "finalized" && (
        <section className="card-elevated border-[var(--primary)]/40 bg-[var(--primary)]/5 p-5">
          <h2 className="text-sm font-semibold text-[var(--primary)]">🏅 Winner</h2>
          {winner ? (
            <p className="mt-1 text-base font-semibold">
              {winner.avatar_emoji ?? "🥋"} {winner.display_name ?? winner.username} — awarded{" "}
              {c.reward_points} pts
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              No one logged anything — no points awarded.
            </p>
          )}
        </section>
      )}

      <section className="card-elevated p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground-muted)]">Leaderboard</h2>
          <span className="text-[10px] uppercase tracking-wide text-[var(--foreground-subtle)]">
            {status === "finalized" ? "Final" : status === "ended" ? "Ended" : "Live"}
          </span>
        </div>
        <ol className="space-y-2">
          {scored.map((entry, i) => {
            const profile = profileById.get(entry.userId);
            if (!profile) return null;
            const isYou = entry.userId === user.id;
            const rank = i + 1;
            return (
              <li
                key={entry.userId}
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
                <span className="text-lg leading-none">{profile.avatar_emoji ?? "🥋"}</span>
                <div className="min-w-0 flex-1">
                  <span className="truncate text-sm font-medium">
                    {profile.display_name ?? profile.username}
                    {isYou && (
                      <span className="ml-1.5 text-[10px] font-semibold text-[var(--primary)]">
                        YOU
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">
                    {formatMetric(entry.metric)}{" "}
                    <span className="text-[11px] font-medium text-[var(--foreground-muted)]">
                      {unit}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function metricLabel(
  c: Pick<ChallengeRow, "metric_type" | "activity_id">,
  detailLabel: string | null,
): string {
  const activity = c.activity_id ? ACTIVITY_BY_ID[c.activity_id] : null;
  switch (c.metric_type) {
    case "count_days":
      return `Days ${activity?.name.toLowerCase() ?? "logged"}`;
    case "sum_duration_min":
      return "Total minutes";
    case "sum_detail":
      return detailLabel ? `Total ${detailLabel.toLowerCase()}` : "Total";
    case "sum_points":
      return "Total points earned";
    case "active_days":
      return "Active days";
  }
}

function formatMetric(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(1);
}

function StatusPill({
  status,
}: {
  status: "upcoming" | "active" | "ended" | "finalized";
}) {
  const styles: Record<typeof status, { bg: string; fg: string; label: string }> = {
    upcoming: { bg: "var(--accent-cyan)", fg: "#05343c", label: "Upcoming" },
    active: { bg: "var(--success)", fg: "#052914", label: "Active" },
    ended: { bg: "var(--warning)", fg: "#3d2800", label: "Ended" },
    finalized: { bg: "var(--primary)", fg: "#ffffff", label: "Finalized" },
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
