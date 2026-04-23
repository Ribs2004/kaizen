import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { beltProgressFor } from "@/lib/belts";
import { streakTierFor } from "@/lib/scoring";

export const metadata = { title: "Today" };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, total_points, current_streak, longest_streak, last_checkin_date")
    .eq("id", user!.id)
    .maybeSingle();

  const totalPoints = profile?.total_points ?? 0;
  const streak = profile?.current_streak ?? 0;
  const belt = beltProgressFor(totalPoints);
  const tier = streakTierFor(streak);

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = profile?.last_checkin_date === today;

  return (
    <div className="fade-up flex flex-col gap-5">
      <section className="card-elevated relative overflow-hidden p-6">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] opacity-20 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
              Current belt
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{belt.current.name}</h1>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              {belt.next
                ? `${belt.pointsToNext.toLocaleString()} pts to ${belt.next.name}`
                : "Max tier — unstoppable."}
            </p>
          </div>
          <div
            className="h-16 w-16 shrink-0 rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${belt.current.color}, ${belt.current.color}AA 60%, transparent 72%)`,
              boxShadow: `0 0 30px ${belt.current.color}66`,
            }}
          />
        </div>
        <div className="relative mt-5">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--background-elevated)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] transition-[width] duration-500"
              style={{ width: `${belt.percent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[var(--foreground-muted)]">
            <span>{totalPoints.toLocaleString()} pts total</span>
            {belt.next && (
              <span>
                {belt.pointsIntoBelt.toLocaleString()} / {(belt.next.threshold - belt.current.threshold).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Current streak" value={`${streak}`} suffix="days" accent="from-[#ff7a45] to-[#facc15]" />
        <Stat label="Streak bonus" value={`${tier.multiplier}x`} suffix={tier.label} accent="from-[#7c5cff] to-[#22d3ee]" />
        <Stat
          label="Longest streak"
          value={`${profile?.longest_streak ?? 0}`}
          suffix="days"
          accent="from-[#22d3ee] to-[#a3e635]"
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <section className="card-elevated p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">
              {checkedInToday ? "Today's check-in is done" : "How did today go?"}
            </h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              {checkedInToday
                ? "Come back tomorrow to keep the streak going."
                : "Log what you did. It takes 20 seconds."}
            </p>
          </div>
          {!checkedInToday && (
            <Link
              href="/check-in"
              className="shrink-0 rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110"
            >
              Check in
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
  className = "",
}: {
  label: string;
  value: string;
  suffix?: string;
  accent: string;
  className?: string;
}) {
  return (
    <div className={`card-elevated relative overflow-hidden p-4 ${className}`}>
      <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-15 blur-xl`} />
      <p className="relative text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
        {label}
      </p>
      <p className="relative mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {suffix && <p className="relative text-xs text-[var(--foreground-muted)]">{suffix}</p>}
    </div>
  );
}
