const args = process.argv.slice(2);

const readArg = (name) => {
  const prefix = `--${name}=`;
  const fromInline = args.find((arg) => arg.startsWith(prefix));
  if (fromInline) {
    return fromInline.slice(prefix.length);
  }

  const index = args.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && index + 1 < args.length) {
    return args[index + 1];
  }

  return "";
};

const runId = readArg("run_id") || readArg("run-id");
if (!runId) {
  console.error("Usage: npm --workspace apps/landing-engine run radiography:evidence -- --run_id=<run_id>");
  process.exit(1);
}

const port = process.env.PORT ?? "3000";
const baseUrl = process.env.RADIOGRAPHY_API_BASE ?? `http://localhost:${port}`;
const endpoint = new URL(`/api/radiography/runlog/evidence/${encodeURIComponent(runId)}`, baseUrl);

const response = await fetch(endpoint, { cache: "no-store" });
const body = await response.json();

if (!response.ok || body?.ok !== true) {
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const artifacts = Array.isArray(body.evidence_index?.artifacts)
  ? body.evidence_index.artifacts
  : [];

console.log(`Evidence ${body.evidence_index.run_id} (${body.evidence_index.created_at})`);
if (artifacts.length === 0) {
  console.log("No artifacts.");
  process.exit(0);
}

for (const artifact of artifacts) {
  console.log(
    `${artifact.kind.padEnd(14)} ${String(artifact.id).padEnd(24)} sha=${String(artifact.sha256).slice(0, 12)} bytes=${artifact.bytes}`
  );
}
