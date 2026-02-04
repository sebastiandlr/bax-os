import Link from "next/link";

export default function StudioPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Studio</h1>
        <Link
          href="/"
          className="rounded-lg border border-zinc-200/60 bg-white/60 px-3 py-1.5 text-sm text-zinc-900 hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-100 dark:hover:bg-zinc-950"
        >
          Volver
        </Link>
      </div>

      <p className="mt-3 text-zinc-600 dark:text-zinc-400">
        Placeholder. Aquí irá el Builder / Studio de BAX-OS.
      </p>

      <div className="mt-8 rounded-xl border border-zinc-200/60 bg-white/60 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="font-medium">Próximo:</div>
        <ul className="mt-2 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
          <li>Route + layout dedicado (opcional)</li>
          <li>UI shell + state</li>
          <li>Spec editor (JSON) + renderer preview</li>
        </ul>
      </div>
    </main>
  );
}