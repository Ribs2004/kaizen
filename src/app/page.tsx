import Link from "next/link";
import { BELTS } from "@/lib/belts";

export default function Landing() {
  return (
    <div className="bg-aurora flex flex-1 flex-col">
      <header className="w-full px-6 pt-6 sm:px-10 sm:pt-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="relative inline-block h-7 w-7">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-[#7c5cff] via-[#ff7a45] to-[#22d3ee]" />
              <span className="absolute inset-[3px] rounded-[5px] bg-[var(--background)]" />
              <span className="absolute inset-0 flex items-center justify-center text-sm">改</span>
            </span>
            <span className="text-lg">Kaizen</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/login"
              className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-[var(--foreground)] px-4 py-2 font-medium text-[var(--background)] transition hover:bg-white"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pt-16 pb-20 text-center sm:px-10 sm:pt-24">
          <span className="fade-up rounded-full border border-[var(--border)] bg-[var(--surface)]/60 px-3 py-1 text-xs text-[var(--foreground-muted)] backdrop-blur">
            Daily check-ins · Belt progression · Built for your phone
          </span>
          <h1 className="fade-up mt-6 max-w-3xl text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Level up your <span className="text-gradient-primary">every day</span>.
          </h1>
          <p className="fade-up mt-5 max-w-xl text-balance text-base leading-7 text-[var(--foreground-muted)] sm:text-lg">
            Kaizen turns your workouts, habits, and wellness routines into a game.
            Check in at the end of each day. Earn points. Keep your streak alive.
            Climb from white belt to black — and beyond.
          </p>
          <div className="fade-up mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110"
            >
              Start your streak
            </Link>
            <Link
              href="#how"
              className="rounded-full border border-[var(--border-strong)] bg-[var(--surface)]/60 px-6 py-3 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
            >
              How it works
            </Link>
          </div>

          <div className="fade-up mt-16 w-full">
            <BeltRail />
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10">
          <div className="grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title="Check in, don't log workouts"
              body="At the end of the day, tap what you did. Add details only if you want. It takes 20 seconds."
              accent="from-[#7c5cff] to-[#22d3ee]"
            />
            <FeatureCard
              title="Streaks that matter"
              body="Show up 7 days in a row for 1.25x points. Hit 100 days for 3x. Miss a day and it resets — so don't."
              accent="from-[#ff7a45] to-[#facc15]"
            />
            <FeatureCard
              title="Compete with friends"
              body="Spin up a group, share the invite link, and see the leaderboard update as everyone puts in work."
              accent="from-[#22d3ee] to-[#a3e635]"
            />
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 pb-8 text-xs text-[var(--foreground-subtle)] sm:px-10">
        Kaizen · 改善 · continuous improvement
      </footer>
    </div>
  );
}

function FeatureCard({
  title,
  body,
  accent,
}: {
  title: string;
  body: string;
  accent: string;
}) {
  return (
    <div className="card-elevated relative overflow-hidden p-6">
      <div
        className={`absolute -top-12 -right-12 h-36 w-36 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`}
      />
      <h3 className="relative text-base font-semibold">{title}</h3>
      <p className="relative mt-2 text-sm leading-6 text-[var(--foreground-muted)]">{body}</p>
    </div>
  );
}

function BeltRail() {
  const visible = BELTS.slice(0, 8);
  return (
    <div className="card-elevated mx-auto max-w-3xl p-5">
      <div className="flex items-center justify-between text-xs text-[var(--foreground-subtle)]">
        <span>White belt</span>
        <span>Black belt</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full">
        {visible.map((b) => (
          <div
            key={b.id}
            className="flex-1"
            style={{ background: b.color, opacity: b.id === "white" ? 0.9 : 1 }}
            title={`${b.name} — ${b.threshold.toLocaleString()} pts`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[10px] text-[var(--foreground-muted)] sm:grid-cols-8">
        {visible.map((b) => (
          <div key={b.id} className="truncate">
            <div className="font-medium text-[var(--foreground)]">{b.name}</div>
            <div>{b.threshold.toLocaleString()} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
