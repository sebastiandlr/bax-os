const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(
    "Usage: npm --workspace apps/landing-engine run radiography:evidence:artifact -- <run_id> <artifact_id> [--port 3000]"
  );
  process.exit(1);
}

const runId = args[0];
const artifactId = args[1];

let port = process.env.PORT ?? "3000";
for (let index = 2; index < args.length; index += 1) {
  const value = args[index];
  if (value === "--port" && index + 1 < args.length) {
    port = args[index + 1];
    index += 1;
    continue;
  }
  if (value.startsWith("--port=")) {
    const parsed = value.slice("--port=".length);
    if (parsed) {
      port = parsed;
    }
  }
}

const baseUrl = process.env.RADIOGRAPHY_API_BASE ?? `http://localhost:${port}`;
const endpoint = new URL(
  `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/artifact/${encodeURIComponent(artifactId)}`,
  baseUrl
);

const response = await fetch(endpoint, { cache: "no-store" });
let body;
try {
  body = await response.json();
} catch {
  body = { ok: false, error: "invalid_json_response" };
}

console.log(JSON.stringify(body, null, 2));
if (!response.ok || body?.ok !== true) {
  process.exit(1);
}
