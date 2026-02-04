import { SiteShell } from "@/components/SiteShell";
import { Hero } from "@/components/Hero";
import { LINKS } from "@/lib/links";
import Link from "next/link";

export default function Home() {
  return (
    <SiteShell>
      <div className="space-y-10">
        <Hero />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-200">
            Docs (source of truth)
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-zinc-300">
            <li><span className="font-mono">docs/manifesto.md</span></li>
            <li><span className="font-mono">docs/capability-map-v0.md</span></li>
            <li><span className="font-mono">docs/dod.md</span></li>
            <li><span className="font-mono">docs/decision-log.md</span></li>
            <li><span className="font-mono">docs/event-schema-v0.md</span></li>
            <li><span className="font-mono">docs/ops/landing-express.md</span></li>
            <li><span className="font-mono">docs/architecture/hybrid-repo-model.md</span></li>
            <li><span className="font-mono">docs/mvp/roadmap.md</span></li>
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
            href="/"
          >
            Home
          </Link>
          <a
            className="rounded-md border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-900"
            href={LINKS.repo}
            target="_blank"
            rel="noreferrer"
          >
            Repo
          </a>
          <a
            className="rounded-md border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-900"
            href={LINKS.docs}
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </section>
      </div>
    </SiteShell>
  );
}