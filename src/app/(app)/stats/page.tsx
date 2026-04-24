import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACTIVITY_BY_ID, CATEGORY_LABELS, type ActivityCategory } from "@/lib/activities";

export const metadata = { title: "Stats" };

type Range = "30d" | "all";

const CATEGORY_COLORS: Record<ActivityCategory, string> = {
  cardio: "var(--accent-orange)",
  strength: "var(--danger)",
  martial: "var(--primary)",
  sport: "var(--accent-cyan)",
  wellness: "var(--accent-lime)",
};

type CheckInRow = {
  local_date: string;
  total_points: number;
  activity_logs: Array<{
    activity_id: string;
    points: number;
    duration_min: number | null;
  }> | null;
};

function todayLocalDate(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rawRange } = await searchParams;
  const range: Range = rawRange === "all" ? "all" : "30d";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("check_ins")
    .select("local_date, total_points, activity_logs(activity_id, points, duration_min)")
    .order("local_date", { ascending: true });

  const today = todayLocalDate();
  const rangeStart = range === "30d" ? addDays(today, -29) : null;
  if (rangeStart) query = query.gte("local_date", rangeStart);

  const { data: rowsRaw } = await query;
  const rows = (rowsRaw ?? []) as CheckInRow[];

  const hasData = rows.length > 0;

  // ---- Aggregates ----
  const totalCheckIns = rows.length;
  const totalPoints = rows.reduce((sum, r) => sum + (r.total_points ?? 0), 0);

  let totalActiveMin = 0;
  const byActivity = new Map<string, { points: number; count: number; minutes: number }>();
  const byCategory = new Map<ActivityCategory, { points: number; count: number }>();

  for (const row of rows) {
    for (const log of row.activity_logs ?? []) {
      totalActiveMin += log.duration_min ?? 0;

      const prev = byActivity.get(log.activity_id) ?? { points: 0, count: 0, minutes: 0 };
      byActivity.set(log.activity_id, {
        points: prev.points + (log.points ?? 0),
        count: prev.count + 1,
        minutes: prev.minutes + (log.duration_min ?? 0),
      });

      const activity = ACTIVITY_BY_ID[log.activity_id];
      if (activity) {
        const prevCat = byCategory.get(activity.category) ?? { points: 0, count: 0 };
        byCategory.set(activity.category, {
          points: prevCat.points + (log.points ?? 0),
          count: prevCat.count + 1,
        });
      }
    }
  }

  const activityRows = [...byActivity.entries()]
    .map(([id, stats]) => ({ id, ...stats, activity: ACTIVITY_BY_ID[id] }))
    .filter((r) => r.activity)
    .sort((a, b) => b.points - a.points);

  const categoryRows = [...byCategory.entries()]
    .map(([cat, stats]) => ({ category: cat, ...stats }))
    .sort((a, b) => b.points - a.points);

  const topActivity = activityRows[0];

  // ---- Daily series for chart ----
  const dailyPoints = new Map<string, number>();
  for (const row of rows) dailyPoints.set(row.local_date, row.total_points ?? 0);

  const seriesStart = range === "30d" ? addDays(today, -29) : rows[0]?.local_date ?? today;
  const seriesDays: Array<{ date: string; points: number }> = [];
  let cursor = seriesStart;
  while (cursor <= today) {
    seriesDays.push({ date: cursor, points: dailyPoints.get(cursor) ?? 0 });
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="fade-up space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stats</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            {range === "30d" ? "Last 30 days" : "All time"}
          </p>
        </div>
        <RangeToggle current={range} />
      </header>

      {!hasData ? (
        <EmptyState range={range} />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Check-ins" value={totalCheckIns.toString()} tint="var(--primary)" />
            <MetricCard
              label="Total points"
              value={totalPoints.toLocaleString()}
              tint="var(--accent-orange)"
            />
            <MetricCard
              label="Active min"
              value={totalActiveMin.toLocaleString()}
              tint="var(--accent-cyan)"
            />
            <MetricCard
              label="Top activity"
              value={topActivity ? `${topActivity.activity.emoji} ${topActivity.activity.name}` : "—"}
              tint="var(--accent-lime)"
              compact
            />
          </section>

          <section className="card-elevated p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground-muted)]">
              Daily points
            </h2>
            <LineChart data={seriesDays} />
          </section>

          <section className="card-elevated p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground-muted)]">
              By activity
            </h2>
            <ActivityBars
              rows={activityRows.map((r) => ({
                id: r.id,
                name: r.activity.name,
                emoji: r.activity.emoji,
                color: CATEGORY_COLORS[r.activity.category],
                points: r.points,
                count: r.count,
                minutes: r.minutes,
              }))}
              max={activityRows[0]?.points ?? 0}
            />
          </section>

          <section className="card-elevated p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--foreground-muted)]">
              By category
            </h2>
            <CategoryBars
              rows={categoryRows.map((r) => ({
                category: r.category,
                label: CATEGORY_LABELS[r.category],
                color: CATEGORY_COLORS[r.category],
                points: r.points,
                count: r.count,
              }))}
              max={categoryRows[0]?.points ?? 0}
            />
          </section>
        </>
      )}
    </div>
  );
}

function RangeToggle({ current }: { current: Range }) {
  const options: Array<{ value: Range; label: string }> = [
    { value: "30d", label: "30 days" },
    { value: "all", label: "All time" },
  ];
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs">
      {options.map((opt) => {
        const active = current === opt.value;
        return (
          <Link
            key={opt.value}
            href={`/stats?range=${opt.value}`}
            className={`rounded-full px-3 py-1.5 font-medium transition ${
              active
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tint,
  compact,
}: {
  label: string;
  value: string;
  tint: string;
  compact?: boolean;
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-4">
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{ background: tint, opacity: 0.7 }}
      />
      <div className="text-[11px] uppercase tracking-wide text-[var(--foreground-subtle)]">
        {label}
      </div>
      <div
        className={`mt-1 font-bold tabular-nums ${compact ? "text-base" : "text-2xl"}`}
        style={compact ? undefined : { color: tint }}
      >
        {value}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: Array<{ date: string; points: number }> }) {
  const width = 640;
  const height = 180;
  const padX = 8;
  const padTop = 12;
  const padBottom = 24;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const n = data.length;
  const maxPoints = Math.max(10, ...data.map((d) => d.points));

  const x = (i: number) => padX + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padTop + innerH - (v / maxPoints) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d.points).toFixed(1)}`)
    .join(" ");

  const areaPath =
    data.length > 0
      ? `${linePath} L ${x(n - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`
      : "";

  // Axis labels: first, middle, last
  const labelIdx = n <= 1 ? [0] : n <= 3 ? [0, n - 1] : [0, Math.floor(n / 2), n - 1];

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
        aria-label="Daily points chart"
      >
        <defs>
          <linearGradient id="pointsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="pointsStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={width - padX}
            y1={padTop + innerH * t}
            y2={padTop + innerH * t}
            stroke="var(--border)"
            strokeDasharray="2 4"
            strokeWidth="1"
          />
        ))}

        {areaPath && <path d={areaPath} fill="url(#pointsFill)" />}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke="url(#pointsStroke)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* dots for days with points */}
        {data.map((d, i) =>
          d.points > 0 ? (
            <circle
              key={d.date}
              cx={x(i)}
              cy={y(d.points)}
              r="2.5"
              fill="#a78bfa"
              stroke="var(--background)"
              strokeWidth="1"
            />
          ) : null,
        )}

        {labelIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            fontSize="11"
            fill="var(--foreground-subtle)"
          >
            {shortDate(data[i].date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ActivityBars({
  rows,
  max,
}: {
  rows: Array<{
    id: string;
    name: string;
    emoji: string;
    color: string;
    points: number;
    count: number;
    minutes: number;
  }>;
  max: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--foreground-muted)]">No activities logged yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = max > 0 ? Math.max(4, (r.points / max) * 100) : 0;
        return (
          <li key={r.id} className="flex items-center gap-3">
            <span className="w-6 text-lg leading-none">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium">{r.name}</span>
                <span className="text-xs text-[var(--foreground-muted)] tabular-nums">
                  {r.points} pts · {r.count}×{r.minutes > 0 ? ` · ${r.minutes}m` : ""}
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: r.color }}
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryBars({
  rows,
  max,
}: {
  rows: Array<{
    category: ActivityCategory;
    label: string;
    color: string;
    points: number;
    count: number;
  }>;
  max: number;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--foreground-muted)]">No categories yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = max > 0 ? Math.max(4, (r.points / max) * 100) : 0;
        return (
          <li key={r.category}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{r.label}</span>
              <span className="text-xs text-[var(--foreground-muted)] tabular-nums">
                {r.points} pts · {r.count}×
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: r.color }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ range }: { range: Range }) {
  return (
    <div className="card-elevated p-10 text-center">
      <div className="mx-auto mb-3 text-4xl">📊</div>
      <h2 className="text-lg font-semibold">Nothing to chart yet</h2>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        {range === "30d"
          ? "Log a check-in to see your last 30 days take shape."
          : "Log your first check-in to unlock your all-time stats."}
      </p>
      <Link
        href="/check-in"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--primary-hover)]"
      >
        <span>✅</span> Check in now
      </Link>
    </div>
  );
}
