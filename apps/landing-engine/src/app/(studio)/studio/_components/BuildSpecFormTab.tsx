import {
  CAPABILITY_IDS_V0,
  type BuildSpecV0,
  type BuildSpecV0CapabilityId
} from "@bax/buildspec";

type BuildSpecFormTabProps = {
  activeSpec: BuildSpecV0;
  onModeChange: (mode: BuildSpecV0["mode"]) => void;
  onCapabilityToggle: (capability: BuildSpecV0CapabilityId, checked: boolean) => void;
  onMetadataChange: (key: "clientId" | "siteId", value: string) => void;
};

export function BuildSpecFormTab({
  activeSpec,
  onModeChange,
  onCapabilityToggle,
  onMetadataChange
}: BuildSpecFormTabProps) {
  return (
    <div className="space-y-4 text-sm">
      <label className="block">
        <span className="text-zinc-300">Mode</span>
        <select
          className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
          value={activeSpec.mode}
          onChange={(event) => onModeChange(event.target.value as BuildSpecV0["mode"])}
        >
          <option value="lead">lead</option>
          <option value="booking">booking</option>
          <option value="quote">quote</option>
        </select>
      </label>

      <div>
        <div className="flex items-center justify-between text-zinc-300">
          <span>Capabilities</span>
          <span className="text-zinc-400">{activeSpec.capabilities.length}/9</span>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {CAPABILITY_IDS_V0.map((capability) => {
            const checked = activeSpec.capabilities.includes(capability);
            const disableAdd = !checked && activeSpec.capabilities.length >= 9;
            return (
              <label key={capability} className="flex items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disableAdd}
                  onChange={(event) => onCapabilityToggle(capability, event.target.checked)}
                />
                <span className="text-xs">{capability}</span>
              </label>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="text-zinc-300">metadata.clientId (optional)</span>
        <input
          className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
          value={activeSpec.metadata?.clientId ?? ""}
          onChange={(event) => onMetadataChange("clientId", event.target.value)}
        />
      </label>

      <label className="block">
        <span className="text-zinc-300">metadata.siteId (optional)</span>
        <input
          className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-zinc-100"
          value={activeSpec.metadata?.siteId ?? ""}
          onChange={(event) => onMetadataChange("siteId", event.target.value)}
        />
      </label>

      <div className="text-zinc-400">
        eventSchemaVersion: <span className="text-zinc-200">0.1.0</span>
      </div>
    </div>
  );
}
