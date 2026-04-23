import Link from "next/link";
import { signupAction } from "@/app/auth/actions";

export const metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="fade-up card-elevated p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Start your streak</h1>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Your first check-in gets you out of white belt.
      </p>

      {error && (
        <div className="mt-5 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      <form action={signupAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="Display name"
          name="display_name"
          type="text"
          autoComplete="name"
          placeholder="What should we call you?"
        />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
        />
        <button
          type="submit"
          className="mt-2 rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110"
        >
          Create account
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--foreground-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--foreground)] hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  required,
  autoComplete,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--foreground-muted)]">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] px-3 py-2.5 text-sm outline-none transition placeholder:text-[var(--foreground-subtle)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]"
      />
      {hint && <span className="text-xs text-[var(--foreground-subtle)]">{hint}</span>}
    </label>
  );
}
