import Link from "next/link";
import { CreateGroupForm } from "./create-group-form";

export const metadata = { title: "New group" };

export default function NewGroupPage() {
  return (
    <div className="fade-up mx-auto max-w-lg space-y-6">
      <div>
        <Link
          href="/groups"
          className="text-xs text-[var(--foreground-muted)] transition hover:text-[var(--foreground)]"
        >
          ← Back to groups
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">New group</h1>
        <p className="mt-1 text-sm text-[var(--foreground-muted)]">
          You'll be the owner. Share the invite link to add members.
        </p>
      </div>

      <CreateGroupForm />
    </div>
  );
}
