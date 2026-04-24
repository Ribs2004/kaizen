"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { ACTIVITIES, CATEGORY_LABELS, type Activity, type ActivityCategory } from "@/lib/activities";
import { basePointsForLog, streakTierFor } from "@/lib/scoring";
import { submitCheckIn, type CheckInState } from "./actions";

const initialCheckInState: CheckInState = { error: null };

type ExistingLog = {
  activity_id: string;
  duration_min: number | null;
  details: Record<string, string | number>;
};

type LogState = {
  selected: boolean;
  expanded: boolean;
  durationMin: string;
  details: Record<string, string>;
};

function initialState(existingLogs: ExistingLog[]): Record<string, LogState> {
  const byId: Record<string, LogState> = {};
  for (const a of ACTIVITIES) {
    byId[a.id] = { selected: false, expanded: false, durationMin: "", details: {} };
  }
  for (const log of existingLogs) {
    const base = byId[log.activity_id];
    if (!base) continue;
    byId[log.activity_id] = {
      selected: true,
      expanded: false,
      durationMin: log.duration_min != null ? String(log.duration_min) : "",
      details: Object.fromEntries(
        Object.entries(log.details ?? {}).map(([k, v]) => [k, String(v)]),
      ),
    };
  }
  return byId;
}

const CATEGORY_ORDER: ActivityCategory[] = ["cardio", "strength", "martial", "sport", "wellness"];

export function CheckInForm({
  localDate,
  currentStreak,
  isEditingToday,
  existingNote,
  existingLogs,
  serverError,
}: {
  localDate: string;
  currentStreak: number;
  isEditingToday: boolean;
  existingNote: string;
  existingLogs: ExistingLog[];
  serverError?: string;
}) {
  const [tiles, setTiles] = useState(() => initialState(existingLogs));
  const [note, setNote] = useState(existingNote);
  const [actionState, formAction] = useActionState(submitCheckIn, initialCheckInState);

  // Streak that today's check-in will produce.
  const projectedStreak = isEditingToday ? currentStreak : currentStreak + 1;
  const tier = streakTierFor(projectedStreak);

  const { selectedCount, basePoints, totalPoints } = useMemo(() => {
    let base = 0;
    let count = 0;
    for (const activity of ACTIVITIES) {
      const s = tiles[activity.id];
      if (!s?.selected) continue;
      count++;
      const durationMin = s.durationMin ? Number(s.durationMin) : null;
      base += basePointsForLog({
        activityId: activity.id,
        durationMin: Number.isFinite(durationMin) ? (durationMin as number) : null,
      });
    }
    return { selectedCount: count, basePoints: base, totalPoints: Math.round(base * tier.multiplier) };
  }, [tiles, tier.multiplier]);

  const byCategory = useMemo(() => {
    const groups: Record<ActivityCategory, Activity[]> = {
      cardio: [],
      strength: [],
      martial: [],
      sport: [],
      wellness: [],
    };
    for (const a of ACTIVITIES) groups[a.category].push(a);
    return groups;
  }, []);

  function toggle(activityId: string) {
    setTiles((prev) => {
      const cur = prev[activityId];
      return { ...prev, [activityId]: { ...cur, selected: !cur.selected } };
    });
  }

  function toggleExpanded(activityId: string) {
    setTiles((prev) => {
      const cur = prev[activityId];
      return { ...prev, [activityId]: { ...cur, expanded: !cur.expanded } };
    });
  }

  function updateDetail(activityId: string, key: string, value: string) {
    setTiles((prev) => {
      const cur = prev[activityId];
      return { ...prev, [activityId]: { ...cur, details: { ...cur.details, [key]: value } } };
    });
  }

  function updateDuration(activityId: string, value: string) {
    setTiles((prev) => {
      const cur = prev[activityId];
      return { ...prev, [activityId]: { ...cur, durationMin: value } };
    });
  }

  return (
    <form action={formAction} className="fade-up flex flex-col gap-5 pb-4">
      <input type="hidden" name="local_date" value={localDate} />

      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
            {isEditingToday ? "Editing today" : "End of day check-in"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            How did {humanDate(localDate)} go?
          </h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Tap what you did. Add details only if you want.
          </p>
        </div>
      </header>

      {(actionState.error || serverError) && (
        <div
          aria-live="polite"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {actionState.error ?? serverError}
        </div>
      )}

      <div className="card-elevated relative overflow-hidden p-5">
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] opacity-20 blur-2xl" />
        <div className="relative grid grid-cols-3 items-end gap-3">
          <Metric label="Activities" value={selectedCount.toString()} />
          <Metric label="Base" value={basePoints.toString()} suffix="pts" />
          <Metric
            label={`${tier.multiplier}x bonus`}
            value={totalPoints.toString()}
            suffix="pts"
            highlight
          />
        </div>
        <p className="relative mt-3 text-xs text-[var(--foreground-muted)]">
          Projected streak: <span className="font-semibold text-[var(--foreground)]">{projectedStreak} days</span> — {tier.label}
        </p>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const activities = byCategory[cat];
        if (activities.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {activities.map((activity) => {
                const s = tiles[activity.id];
                return (
                  <ActivityTile
                    key={activity.id}
                    activity={activity}
                    state={s}
                    onToggle={() => toggle(activity.id)}
                    onExpand={() => toggleExpanded(activity.id)}
                    onDuration={(v) => updateDuration(activity.id, v)}
                    onDetail={(k, v) => updateDetail(activity.id, k, v)}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-[var(--foreground-subtle)]">
          Note (optional)
        </h2>
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anything worth remembering about today?"
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--foreground-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]"
        />
      </section>

      <div className="fixed inset-x-0 bottom-[64px] z-10 border-t border-[var(--border)] bg-[var(--background)]/90 px-4 py-3 backdrop-blur sm:bottom-[68px] sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-semibold">{totalPoints} pts</div>
            <div className="text-xs text-[var(--foreground-muted)]">
              {selectedCount} {selectedCount === 1 ? "activity" : "activities"}
            </div>
          </div>
          <SubmitButton
            disabledWhenIdle={selectedCount === 0}
            idleLabel={isEditingToday ? "Update check-in" : "Complete check-in"}
          />
        </div>
      </div>
    </form>
  );
}

function SubmitButton({
  disabledWhenIdle,
  idleLabel,
}: {
  disabledWhenIdle: boolean;
  idleLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabledWhenIdle || pending}
      className="rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition enabled:hover:brightness-110 disabled:opacity-40"
    >
      {pending ? "Saving…" : idleLabel}
    </button>
  );
}

function ActivityTile({
  activity,
  state,
  onToggle,
  onExpand,
  onDuration,
  onDetail,
}: {
  activity: Activity;
  state: LogState;
  onToggle: () => void;
  onExpand: () => void;
  onDuration: (v: string) => void;
  onDetail: (k: string, v: string) => void;
}) {
  const hasDetails = activity.details.length > 0;
  const durationField = activity.details.find((f) => f.key === "duration_min");
  const otherFields = activity.details.filter((f) => f.key !== "duration_min");

  return (
    <div
      className={`relative rounded-xl border transition ${
        state.selected
          ? "border-[var(--primary)] bg-[var(--primary)]/10"
          : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-3 text-left"
      >
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-lg text-xl transition ${
            state.selected ? "bg-[var(--primary)]/20" : "bg-[var(--background-elevated)]"
          }`}
        >
          {activity.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{activity.name}</div>
          <div className="text-[11px] text-[var(--foreground-muted)]">
            +{activity.basePoints} pts
            {activity.durationBonusPer10Min > 0 && ` · +${activity.durationBonusPer10Min}/10min`}
          </div>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            state.selected
              ? "border-[var(--primary)] bg-[var(--primary)]"
              : "border-[var(--border-strong)] bg-transparent"
          }`}
        >
          {state.selected && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </button>

      {state.selected && hasDetails && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          {!state.expanded ? (
            <button
              type="button"
              onClick={onExpand}
              className="text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            >
              + add details
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {durationField && (
                <DetailField
                  fieldKey={durationField.key}
                  activityId={activity.id}
                  label={durationField.label}
                  unit={durationField.unit}
                  placeholder={durationField.placeholder}
                  kind="number"
                  value={state.durationMin}
                  onChange={(v) => onDuration(v)}
                />
              )}
              {otherFields.map((f) => (
                <DetailField
                  key={f.key}
                  fieldKey={f.key}
                  activityId={activity.id}
                  label={f.label}
                  unit={f.unit}
                  placeholder={f.placeholder}
                  kind={f.kind === "number" ? "number" : "text"}
                  value={state.details[f.key] ?? ""}
                  onChange={(v) => onDetail(f.key, v)}
                />
              ))}
              <button
                type="button"
                onClick={onExpand}
                className="self-start text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                − hide
              </button>
            </div>
          )}
        </div>
      )}

      {state.selected && (
        <input type="hidden" name="activity_ids" value={activity.id} />
      )}
    </div>
  );
}

function DetailField({
  fieldKey,
  activityId,
  label,
  unit,
  placeholder,
  kind,
  value,
  onChange,
}: {
  fieldKey: string;
  activityId: string;
  label: string;
  unit?: string;
  placeholder?: string;
  kind: "number" | "text";
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
        {label}
        {unit ? ` (${unit})` : ""}
      </span>
      <input
        name={`detail_${activityId}_${fieldKey}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={kind === "number" ? "number" : "text"}
        inputMode={kind === "number" ? "decimal" : undefined}
        placeholder={placeholder}
        className="rounded-md border border-[var(--border)] bg-[var(--background-elevated)] px-2 py-1.5 text-sm outline-none transition placeholder:text-[var(--foreground-subtle)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)]"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  suffix,
  highlight,
}: {
  label: string;
  value: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--foreground-subtle)]">
        {label}
      </div>
      <div
        className={`mt-0.5 text-2xl font-semibold tracking-tight ${
          highlight ? "text-gradient-primary" : ""
        }`}
      >
        {value}
        {suffix && <span className="ml-0.5 text-xs font-medium text-[var(--foreground-muted)]">{suffix}</span>}
      </div>
    </div>
  );
}

function humanDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = date.getTime() === today.getTime();
  if (isToday) return "today";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
