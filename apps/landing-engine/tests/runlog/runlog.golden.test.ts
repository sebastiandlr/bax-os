import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

type RunLogFixtureInput = {
  run_id: string;
  created_at?: string;
  duration_ms?: number;
  status?: "pass" | "soft_fail" | "hard_fail";
  core_percent?: number;
  reason_codes?: string[];
  hard_count?: number;
  warn_count?: number;
  items_count?: number;
  patch_ops?: number;
  coverage_percent?: number;
  capabilities?: string[];
  hosts?: string[];
  blockers?: string[];
};

const importFresh = async <T>(filePath: string): Promise<T> => {
  const moduleUrl = `${pathToFileURL(path.resolve(filePath)).href}?v=${Date.now()}-${Math.random()}`;
  return import(moduleUrl) as Promise<T>;
};

const createRunLogFixture = (input: RunLogFixtureInput) => {
  return {
    runlog_version: "0.1.0",
    run_id: input.run_id,
    created_at: input.created_at ?? "2026-02-16T00:00:00.000Z",
    duration_ms: input.duration_ms ?? 10,
    inputs: {
      contractVersion: "0.1.0",
      business_name: "PLACEHOLDER: BAX Demo",
      city: "PLACEHOLDER: CDMX",
      country: "MX",
      language: "es",
      mode_hint: "lead",
      seed_urls: {
        count: input.hosts?.length ?? 1,
        unique_hosts: input.hosts ?? ["example.com"],
        url_hashes: ["4c70119c7bfdd28cfbae5905985d9f0d5dc6b40e4ce1782c25f9307e46f607b8"]
      }
    },
    buildspec: {
      schemaVersion: "0.1.0",
      eventSchemaVersion: "0.1.0",
      mode: "lead",
      capabilities: input.capabilities ?? ["hero_identity_block", "analytics_core"]
    },
    outputs: {
      gating_decision: {
        status: input.status ?? "soft_fail",
        core_percent: input.core_percent ?? 50,
        reason_codes: input.reason_codes ?? ["needs_manual_verify"]
      },
      lint_report: {
        items_count: input.items_count ?? 1,
        hard_count: input.hard_count ?? 0,
        warn_count: input.warn_count ?? 1,
        top_reason_codes: ["needs_manual_verify"]
      },
      patch_stats: {
        ops_count: input.patch_ops ?? 2
      },
      provenance_coverage_percent: input.coverage_percent ?? 40
    },
    debug: {
      core_fields_present: 3,
      publish_blockers_present: 0,
      top_missing_core_fields: ["/site/language"],
      top_blockers: input.blockers ?? ["needs_manual_verify"]
    }
  };
};

let testRoot = "";
let runlogDir = "";

test.before(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "bax-runlog-golden-"));
  runlogDir = path.join(testRoot, "runlogs");
  await mkdir(runlogDir, { recursive: true });
  process.env.BAX_RUNLOG_DIR = runlogDir;
});

test.after(async () => {
  if (testRoot) {
    await rm(testRoot, { recursive: true, force: true });
  }
});

const resetRunlogDir = async () => {
  const files = await readdir(runlogDir);
  await Promise.all(files.map((fileName) => rm(path.join(runlogDir, fileName), { force: true })));
};

test("runlogStorage.listRunLogs ignores invalid JSON and keeps deterministic order", async () => {
  await resetRunlogDir();

  const { listRunLogs } = await importFresh<{
    listRunLogs: (limit: number) => Promise<
      Array<{
        run_id: string;
        created_at: string;
        duration_ms: number;
        status: string;
        core_percent: number;
        reason_codes: string[];
        seed_urls_count: number;
        unique_hosts_count: number;
      }>
    >;
  }>("src/lib/radiography/runlogStorage.ts");

  await writeFile(
    path.join(runlogDir, "newer.json"),
    `${JSON.stringify(createRunLogFixture({ run_id: "run-newer1" }), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(runlogDir, "alpha.json"),
    `${JSON.stringify(createRunLogFixture({ run_id: "run-alpha1" }), null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(runlogDir, "beta.json"),
    `${JSON.stringify(createRunLogFixture({ run_id: "run-beta01" }), null, 2)}\n`,
    "utf8"
  );
  await writeFile(path.join(runlogDir, "invalid.json"), "{ invalid", "utf8");

  const now = new Date();
  const older = new Date(now.getTime() - 60_000);
  await utimes(path.join(runlogDir, "newer.json"), now, now);
  await utimes(path.join(runlogDir, "alpha.json"), older, older);
  await utimes(path.join(runlogDir, "beta.json"), older, older);
  await utimes(path.join(runlogDir, "invalid.json"), now, now);

  const items = await listRunLogs(10);
  assert.equal(items.length, 3);
  assert.deepEqual(
    items.map((item) => item.run_id),
    ["run-newer1", "run-alpha1", "run-beta01"]
  );

  for (const item of items) {
    assert.equal("path" in item, false);
    assert.equal("seed_urls_raw" in item, false);
  }
});

test("runlog POST redacts forbidden keys before persistence", async () => {
  await resetRunlogDir();

  const route = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );

  const baseRunlog = createRunLogFixture({ run_id: "run-strip1" }) as Record<string, unknown>;
  baseRunlog.path = "/Users/private/.bax/runlogs/run-strip1.json";
  (baseRunlog.inputs as Record<string, unknown>).seed_urls = {
    count: 0,
    unique_hosts: [],
    url_hashes: [],
    urls: ["https://forbidden.example/path"]
  };

  const request = new Request("http://localhost/api/radiography/runlog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runlog: baseRunlog,
      seed_urls_raw: ["https://example.com/demo?x=1"]
    })
  });

  const response = await route.POST(request);
  const body = (await response.json()) as { ok?: boolean; run_id?: string };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(typeof body.run_id, "string");

  const persistedPath = path.join(runlogDir, `${body.run_id as string}.json`);
  const persistedText = await readFile(persistedPath, "utf8");
  assert.equal(persistedText.includes("/Users/"), false);
  assert.equal(persistedText.includes("http"), false);
  assert.equal(persistedText.includes("seed_urls_raw"), false);
  assert.equal(persistedText.includes("\"path\""), false);
});

test("pruneRunLogs respects bounds and never touches files outside runlog directory", async () => {
  await resetRunlogDir();

  const outsideFile = path.join(testRoot, "outside.json");
  await writeFile(outsideFile, "{\"safe\":true}\n", "utf8");

  const olderFile = path.join(runlogDir, "older.json");
  const keepFile = path.join(runlogDir, "keep.json");
  const extraFile = path.join(runlogDir, "extra.json");
  await writeFile(olderFile, "{}\n", "utf8");
  await writeFile(keepFile, "{}\n", "utf8");
  await writeFile(extraFile, "{}\n", "utf8");

  const now = new Date();
  const oldDate = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const freshDate = new Date(now.getTime() - 1_000);
  await utimes(olderFile, oldDate, oldDate);
  await utimes(keepFile, freshDate, freshDate);
  await utimes(extraFile, freshDate, freshDate);

  const { pruneRunLogs } = await importFresh<{
    pruneRunLogs: (opts?: { maxFiles?: number; maxAgeDays?: number }) => Promise<{
      deleted: number;
      kept: number;
      scanned: number;
    }>;
  }>("src/lib/radiography/runlogStorage.ts");

  const result = await pruneRunLogs({ maxFiles: 1, maxAgeDays: 14 });
  assert.equal(result.scanned, 3);
  assert.equal(result.deleted, 2);
  assert.equal(result.kept, 1);

  const outsideStat = await stat(outsideFile);
  assert.equal(outsideStat.isFile(), true);
});

test("computeRunLogDiff returns blocker and delta changes deterministically", async () => {
  const { computeRunLogDiff } = await importFresh<{
    computeRunLogDiff: (fromRunlog: unknown, toRunlog: unknown) => {
      changes: {
        blockers: { added: string[]; removed: string[] };
        patch_ops_count: { delta: number };
        provenance_coverage_percent: { delta: number };
        capabilities_changed: { added: string[]; removed: string[] };
        seed_hosts_changed: { added: string[]; removed: string[] };
      };
    };
  }>("src/lib/radiography/runlogUtils.ts");

  const fromRunlog = createRunLogFixture({
    run_id: "run-from1",
    blockers: ["needs_manual_verify"],
    patch_ops: 2,
    coverage_percent: 40,
    capabilities: ["hero_identity_block", "analytics_core"],
    hosts: ["example.com"]
  });

  const toRunlog = createRunLogFixture({
    run_id: "run-to001",
    blockers: ["needs_manual_verify", "unverified_publish_blocker"],
    patch_ops: 5,
    coverage_percent: 60,
    capabilities: ["hero_identity_block", "offer_showcase"],
    hosts: ["example.com", "maps.example.com"]
  });

  const diff = computeRunLogDiff(fromRunlog, toRunlog);
  assert.deepEqual(diff.changes.blockers.added, ["unverified_publish_blocker"]);
  assert.deepEqual(diff.changes.blockers.removed, []);
  assert.equal(diff.changes.patch_ops_count.delta, 3);
  assert.equal(diff.changes.provenance_coverage_percent.delta, 20);
  assert.deepEqual(diff.changes.capabilities_changed.added, ["offer_showcase"]);
  assert.deepEqual(diff.changes.capabilities_changed.removed, ["analytics_core"]);
  assert.deepEqual(diff.changes.seed_hosts_changed.added, ["maps.example.com"]);
  assert.deepEqual(diff.changes.seed_hosts_changed.removed, []);
});
