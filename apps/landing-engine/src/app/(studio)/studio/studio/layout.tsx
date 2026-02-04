import type { ReactNode } from "react";
import Link from "next/link";

export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-800" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">BAX-OS</div>
              <div className="text-xs text-zinc-400">Studio</div>
            </div>
          </div>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-md px-3 py-1.5 hover:bg-zinc-900" href="/">
              Home
            </Link>
            <a
              className="rounded-md px-3 py-1.5 hover:bg-zinc-900"
              href="https://github.com/sebastiandlr/bax-os"
              target="_blank"
              rel="noreferrer"
            >
              Repo
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}