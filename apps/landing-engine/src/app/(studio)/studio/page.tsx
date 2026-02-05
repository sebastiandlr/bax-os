import Link from "next/link";
import { loadBuildSpec } from "@/lib/spec/loadBuildSpec";

export default async function StudioPage() {
  const result = await loadBuildSpec();

  return (
    <section className="mx-auto max-w-3xl py-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Studio</h1>

        <Link
          href="/"
          className="rounded-md border border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Volver
        </Link>
      </div>

      <p className="mt-3 text-zinc-400">
        Placeholder. Aquí irá el Builder / Studio de BAX-OS.
      </p>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="font-medium text-zinc-200">BuildSpec</div>
          <span className="text-xs uppercase text-zinc-500">
            {result.source === "local" ? "Local" : "Example"}
          </span>
        </div>

        {result.ok ? (
          <div className="mt-3 text-zinc-300">
            <div className="text-zinc-200">
              Schema v{result.spec.schemaVersion}
            </div>
            <div className="mt-1 text-zinc-400">
              Mode: <span className="text-zinc-200">{result.spec.mode}</span>
            </div>
            <ul className="mt-3 list-disc pl-5 text-zinc-300">
              {result.spec.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="mt-3 list-disc pl-5 text-rose-300">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm">
        <div className="font-medium text-zinc-200">Próximo</div>
        <ul className="mt-2 list-disc pl-5 text-zinc-300">
          <li>UI shell + state</li>
          <li>Spec editor (JSON)</li>
          <li>Renderer de preview</li>
        </ul>
      </div>
    </section>
  );
}
