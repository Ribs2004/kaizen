"use client";

import { useActionState, useMemo, useState } from "react";
import { ACTIVITIES } from "@/lib/activities";
import {
  computeChallengeReward,
  metricOptionsFor,
  todayIso,
  type MetricType,
} from "@/lib/challenges";
import { createChallengeAction, type CreateChallengeState } from "../challenges/actions";

const initialState: CreateChallengeState = { error: null };
const ANY = "__any__";

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

export function NewChallengeForm({ groupId }: { groupId: string }) {
  const [state, formAction, pending] = useActionState(createChallengeAction, initialState);

  const today = useMemo(todayIso, []);
  const [activityValue, setActivityValue] = useState<string>(ANY);
  const [metricIndex, setMetricIndex] = useState(0);
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(addDays(today, 13));

  const activityId = activityValue === ANY ? null : activityValue;
  const options = useMemo(() => metricOptionsFor(activityId), [activityId]);
  const metric = options[metricIndex] ?? options[0];

  const reward = useMemo(
    () =>
      endsAt >= startsAt
        ? computeChallengeReward({ startsAt, endsAt, activityId })
        : 0,
    [startsAt, endsAt, activityId],
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="group_id" value={groupId} />

      {state.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="text-xs font-medium text-[var(--foreground-muted)]">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. 2-week reading sprint"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <label htmlFor="activity_id" className="text-xs font-medium text-[var(--foreground-muted)]">
          Activity
        </label>
        <select
          id="activity_id"
          name="activity_id"
          value={activityValue}
          onChange={(e) => {
            setActivityValue(e.target.value);
            setMetricIndex(0);
          }}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        >
          <option value={ANY}>Any activity (Active days)</option>
          {ACTIVITIES.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="metric_choice" className="text-xs font-medium text-[var(--foreground-muted)]">
          Measure by
        </label>
        <select
          id="metric_choice"
          value={String(metricIndex)}
          onChange={(e) => setMetricIndex(Number(e.target.value))}
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        >
          {options.map((o, i) => (
            <option key={`${o.type}-${o.detailKey ?? ""}`} value={String(i)}>
              {o.label}
              {o.unit ? ` (${o.unit})` : ""}
            </option>
          ))}
        </select>
        <input type="hidden" name="metric_type" value={metric?.type ?? ("active_days" as MetricType)} />
        <input type="hidden" name="detail_key" value={metric?.detailKey ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="starts_at" className="text-xs font-medium text-[var(--foreground-muted)]">
            Start
          </label>
          <input
            id="starts_at"
            name="starts_at"
            type="date"
            required
            value={startsAt}
            min={today}
            onChange={(e) => setStartsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
          />
        </div>
        <div>
          <label htmlFor="ends_at" className="text-xs font-medium text-[var(--foreground-muted)]">
            End
          </label>
          <input
            id="ends_at"
            name="ends_at"
            type="date"
            required
            value={endsAt}
            min={startsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="text-xs font-medium text-[var(--foreground-muted)]">
          Description <span className="text-[var(--foreground-subtle)]">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={280}
          placeholder="What's the goal?"
          className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] px-3 py-2.5 text-xs text-[var(--foreground-muted)]">
        Winner gets{" "}
        <span className="font-semibold text-[var(--foreground)]">
          {reward.toLocaleString()} pts
        </span>{" "}
        — scales with duration (up to 4 weeks) and activity effort.
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create challenge"}
      </button>
    </form>
  );
}
