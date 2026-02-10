import type { RadiographyInputsState } from "../_lib/types";

type RadiographyInputsProps = {
  value: RadiographyInputsState;
  onChange: (key: keyof RadiographyInputsState, value: string) => void;
};

export function RadiographyInputs({ value, onChange }: RadiographyInputsProps) {
  return (
    <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="text-zinc-200">Radiography Inputs</div>
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="text-zinc-300">business_name</span>
          <input
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            value={value.business_name}
            onChange={(event) => onChange("business_name", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-300">city</span>
          <input
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            value={value.city}
            onChange={(event) => onChange("city", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-300">country</span>
          <input
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            value={value.country}
            onChange={(event) => onChange("country", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-300">language</span>
          <input
            className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
            value={value.language}
            onChange={(event) => onChange("language", event.target.value)}
          />
        </label>
        <label className="block">
          <span className="text-zinc-300">seed_urls (one per line)</span>
          <textarea
            className="mt-1 min-h-[96px] w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-100"
            value={value.seed_urls_text}
            onChange={(event) => onChange("seed_urls_text", event.target.value)}
            spellCheck={false}
          />
        </label>
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        Stored locally in your browser (localStorage).
      </div>
    </div>
  );
}
