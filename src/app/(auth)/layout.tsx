import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-aurora flex flex-1 flex-col">
      <header className="w-full px-6 pt-6 sm:px-10 sm:pt-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="relative inline-block h-7 w-7">
              <span className="absolute inset-0 rounded-md bg-gradient-to-br from-[#7c5cff] via-[#ff7a45] to-[#22d3ee]" />
              <span className="absolute inset-[3px] rounded-[5px] bg-[var(--background)]" />
              <span className="absolute inset-0 flex items-center justify-center text-sm">改</span>
            </span>
            <span className="text-lg">Kaizen</span>
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
