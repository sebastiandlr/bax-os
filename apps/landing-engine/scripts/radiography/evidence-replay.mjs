import { readFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

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

const hasFlag = (flag, values) => values.includes(flag);

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

    if (value === "--port" || value === "--run-id") {
      index += 1;
    }
  }
  return positional;
};

const run = async () => {
  const positional = stripOptions(args);
  const bundlePath = positional[0];
  if (!bundlePath) {
    console.error(
      "Usage: npm --workspace apps/landing-engine run radiography:evidence:replay -- <bundle.json> [--port 3000] [--persist] [--run-id <id>] [--no-strict]"
    );
    process.exit(1);
  }

  const port = readOption("port", args) || process.env.PORT || "3000";
  const baseUrl = process.env.RADIOGRAPHY_API_BASE ?? `http://localhost:${port}`;
  const persist = hasFlag("--persist", args);
  const strict = !hasFlag("--no-strict", args);
  const runId = readOption("run-id", args);

  const resolvedPath = path.resolve(bundlePath);
  const bundleText = await readFile(resolvedPath, "utf8");

  let bundle;
  try {
    bundle = JSON.parse(bundleText);
  } catch {
    console.error("Bundle file must contain valid JSON");
    process.exit(1);
  }

  const endpoint = new URL("/api/radiography/runlog/evidence/replay", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      bundle,
      options: {
        persist_stub: persist,
        ...(persist && runId ? { run_id: runId } : {}),
        strict
      }
    })
  });

  const body = await response.json();
  console.log(`${JSON.stringify(body, null, 2)}\n`);

  if (!response.ok || body?.ok !== true) {
    process.exit(1);
  }
};

await run();
