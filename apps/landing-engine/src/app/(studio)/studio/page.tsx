import Link from "next/link";
import { runRadiographyV0 } from "@bax/radiography-runner";

export default async function StudioPage() {
  const radiography = runRadiographyV0({
    contractVersion: "0.1.0",
    business_name: "BAX Demo",
    city: "CDMX",
    country: "MX",
    seed_urls: ["https://example.com"],
    mode_hint: "lead",
    language: "es"
  });

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
          <div className="font-medium text-zinc-200">Radiography</div>
          <span className="text-xs uppercase text-zinc-500">Stage 0.1</span>
        </div>

        <div className="mt-3 text-zinc-300">
          <div className="text-zinc-200">
            Gating: {radiography.gating_decision.status}
          </div>
          <div className="mt-1 text-zinc-400">
            Core coverage:{" "}
            <span className="text-zinc-200">
              {radiography.gating_decision.core_percent}%
            </span>
          </div>
          <div className="mt-1 text-zinc-400">
            Unknown fields:{" "}
            <span className="text-zinc-200">
              {radiography.run_metadata.unknown_fields_count}
            </span>
          </div>
          <div className="mt-1 text-zinc-400">
            Display rules v{radiography.display_rules_version}
          </div>

          <div className="mt-3 text-zinc-200">Reason codes</div>
          <ul className="mt-1 list-disc pl-5 text-zinc-300">
            {radiography.gating_decision.reason_codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>

          <div className="mt-3 text-zinc-200">BuildSpec</div>
          <div className="mt-1 text-zinc-400">
            Schema v{radiography.composer_preset.schemaVersion}
          </div>
          <div className="mt-1 text-zinc-400">
            Mode:{" "}
            <span className="text-zinc-200">
              {radiography.composer_preset.mode}
            </span>
          </div>
          <ul className="mt-2 list-disc pl-5 text-zinc-300">
            {radiography.composer_preset.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </div>
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
