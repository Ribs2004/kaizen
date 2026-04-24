import Link from "next/link";
import type { ReactNode } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/auth/actions";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Auth is enforced by the proxy (src/proxy.ts) for /dashboard, /check-in, etc.
  // We intentionally don't call supabase.auth.getUser() here — it can trigger a
  // silent token rotation during SSR render, which can't set cookies and ends
  // up invalidating the session on the next POST.
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_emoji, total_points, current_streak")
    .maybeSingle();

  const displayName = profile?.display_name ?? profile?.username ?? "Athlete";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="relative inline-block h-7 w-7">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-[#7c5cff] via-[#ff7a45] to-[#22d3ee]" />
              <span className="absolute inset-[3px] rounded-[5px] bg-[var(--background)]" />
              <span className="absolute inset-0 flex items-center justify-center text-sm">改</span>
            </span>
            <span className="text-base">Kaizen</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-[var(--foreground-muted)] sm:inline">
              {profile?.avatar_emoji ?? "🥋"} {displayName}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--foreground-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 sm:px-6">{children}</main>
      <BottomNav />
    </div>
  );
}

function BottomNav() {
  const items = [
    { href: "/dashboard", label: "Today", icon: "🏠" },
    { href: "/check-in", label: "Check in", icon: "✅" },
    { href: "/history", label: "History", icon: "📅" },
    { href: "/stats", label: "Stats", icon: "📊" },
    { href: "/groups", label: "Groups", icon: "👥" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <ul className="mx-auto flex max-w-5xl items-stretch justify-between px-2 py-2 sm:px-6">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-medium text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
