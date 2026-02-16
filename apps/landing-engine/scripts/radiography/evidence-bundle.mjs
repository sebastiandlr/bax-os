import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const mode = args[0];

const readOption = (name, values) => {
  const inlinePrefix = `--${name}=`;
  const inlineValue = values.find((value) => value.startsWith(inlinePrefix));
  if (inlineValue) {
    return inlineValue.slice(inlinePrefix.length);
  }

  const index = values.findIndex((value) => value === `--${name}`);
  if (index >= 0 && index + 1 < values.length) {
    return values[index + 1];
  }

  return "";
};

const stripOptions = (values) => {
  const positional = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) {
      positional.push(value);
      continue;
    }

    if (value.includes("=")) {
      continue;
    }

    if (value === "--out" || value === "--port") {
      index += 1;
    }
  }
  return positional;
};

const run = async () => {
  if (mode !== "export" && mode !== "import") {
    console.error(
      "Usage:\n  npm --workspace apps/landing-engine run radiography:evidence:bundle -- <run_id> --out /tmp/bundle.json [--port 3000]\n  npm --workspace apps/landing-engine run radiography:evidence:import -- /tmp/bundle.json [--port 3000]"
    );
    process.exit(1);
  }

  const modeArgs = args.slice(1);
  const positional = stripOptions(modeArgs);
  const port = readOption("port", modeArgs) || process.env.PORT || "3000";
  const baseUrl = process.env.RADIOGRAPHY_API_BASE ?? `http://localhost:${port}`;

  if (mode === "export") {
    const runId = positional[0];
    const outPath = readOption("out", modeArgs);

    if (!runId || !outPath) {
      console.error("Usage: radiography:evidence:bundle -- <run_id> --out /tmp/bundle.json [--port 3000]");
      process.exit(1);
    }

    const endpoint = new URL(
      `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/bundle`,
      baseUrl
    );

    const response = await fetch(endpoint, { cache: "no-store" });
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }

    if (!response.ok || !payload) {
      console.error(text || JSON.stringify({ ok: false, error: "invalid_response" }, null, 2));
      process.exit(1);
    }

    const filePath = path.resolve(outPath);
    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`Bundle exported: ${filePath}`);
    console.log(`run_id=${payload.run_id} artifacts=${Array.isArray(payload.artifacts) ? payload.artifacts.length : 0}`);
    return;
  }

  const bundlePath = positional[0];
  if (!bundlePath) {
    console.error("Usage: radiography:evidence:import -- /tmp/bundle.json [--port 3000]");
    process.exit(1);
  }

  const filePath = path.resolve(bundlePath);
  const fileText = await readFile(filePath, "utf8");
  let bundle;
  try {
    bundle = JSON.parse(fileText);
  } catch {
    console.error("Bundle file must contain valid JSON");
    process.exit(1);
  }

  const endpoint = new URL("/api/radiography/runlog/evidence/import", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ bundle })
  });

  const body = await response.json();
  console.log(JSON.stringify(body, null, 2));
  if (!response.ok || body?.ok !== true) {
    process.exit(1);
  }
};

await run();
