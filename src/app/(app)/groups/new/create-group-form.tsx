"use client";

import { useActionState } from "react";
import { createGroupAction, type CreateGroupState } from "../actions";

const initialState: CreateGroupState = { error: null };

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroupAction, initialState);

  return (
    <form action={formAction} className="card-elevated space-y-4 p-5">
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
          maxLength={60}
          autoFocus
          placeholder="e.g. Monday morning crew"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="text-xs font-medium text-[var(--foreground-muted)]"
        >
          Description <span className="text-[var(--foreground-subtle)]">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={280}
          placeholder="What's this group about?"
          className="mt-1 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)]"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create group"}
      </button>
    </form>
  );
}
