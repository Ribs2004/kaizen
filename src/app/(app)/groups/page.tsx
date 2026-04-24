import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Groups" };

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_by: string;
};

export default async function GroupsPage() {
  const supabase = await createSupabaseServerClient();

  // group_members first — RLS on groups only returns groups I'm a member of
  // via the "members can read their groups" policy, but the overlapping
  // "authenticated users can read groups" policy returns all. We filter
  // explicitly to my memberships to keep this list tight.
  const { data: memberships } = await supabase
    .from("group_members")
    .select("group_id, role, joined_at, groups(id, name, description, invite_code, created_by)")
    .order("joined_at", { ascending: false });

  const rows = (memberships ?? [])
    .map((m) => ({
      role: m.role as "owner" | "member",
      group: (Array.isArray(m.groups) ? m.groups[0] : m.groups) as GroupRow | undefined,
    }))
    .filter((r): r is { role: "owner" | "member"; group: GroupRow } => !!r.group);

  return (
    <div className="fade-up space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Compete with friends. Share an invite link to bring them in.
          </p>
        </div>
        <Link
          href="/groups/new"
          className="shrink-0 rounded-full bg-gradient-to-r from-[#7c5cff] via-[#a855f7] to-[#ff7a45] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_40px_-10px_rgba(124,92,255,0.6)] transition hover:brightness-110"
        >
          + New group
        </Link>
      </header>

      {rows.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <div className="mx-auto mb-3 text-4xl">👥</div>
          <h2 className="text-lg font-semibold">No groups yet</h2>
          <p className="mt-1 text-sm text-[var(--foreground-muted)]">
            Create your first group, or paste an invite link you've been sent.
          </p>
          <Link
            href="/groups/new"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[var(--primary-hover)]"
          >
            Create a group
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ group, role }) => (
            <li key={group.id}>
              <Link
                href={`/groups/${group.id}`}
                className="card-elevated flex items-center gap-4 p-4 transition hover:border-[var(--border-strong)]"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] text-xl text-white">
                  👥
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{group.name}</h3>
                    {role === "owner" && (
                      <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                        Owner
                      </span>
                    )}
                  </div>
                  {group.description && (
                    <p className="mt-0.5 truncate text-xs text-[var(--foreground-muted)]">
                      {group.description}
                    </p>
                  )}
                </div>
                <span className="text-[var(--foreground-subtle)]">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
