"use client";

import { useActionState } from "react";
import { joinGroupAction, type JoinGroupState } from "../../groups/actions";

const initialState: JoinGroupState = { error: null };

export function JoinGroupForm({ inviteCode }: { inviteCode: string }) {
  const [state, formAction, pending] = useActionState(joinGroupAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="invite_code" value={inviteCode} />

      {state.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]"
        >
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Joining…" : "Join group"}
      </button>
    </form>
  );
}
