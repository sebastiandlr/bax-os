import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { EvidenceReplayResponseV0Schema } from "@bax/radiography-contract";

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
let evidenceDir = "";

test.before(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "bax-runlog-golden-"));
  runlogDir = path.join(testRoot, "runlogs");
  evidenceDir = path.join(testRoot, "evidence");
  await mkdir(runlogDir, { recursive: true });
  await mkdir(evidenceDir, { recursive: true });
  process.env.BAX_RUNLOG_DIR = runlogDir;
  process.env.BAX_EVIDENCE_DIR = evidenceDir;
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

const resetEvidenceDir = async () => {
  const runDirs = await readdir(evidenceDir);
  await Promise.all(
    runDirs.map((entryName) => rm(path.join(evidenceDir, entryName), { recursive: true, force: true }))
  );
};

const assertNoLeakPatterns = (value: string) => {
  assert.equal(value.includes("/Users/"), false);
  assert.equal(value.includes("\\\\Users\\\\"), false);
  assert.equal(value.includes(".bax/runlogs"), false);
  assert.equal(value.includes("http://"), false);
  assert.equal(value.includes("https://"), false);
};

test("runlogStorage.listRunLogs ignores invalid JSON and keeps deterministic order", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

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
  await resetEvidenceDir();

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
  await resetEvidenceDir();

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

test("runlog persist writes evidence pack artifacts without raw URL leaks", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const route = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );

  const request = new Request("http://localhost/api/radiography/runlog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runlog: createRunLogFixture({ run_id: "run-evid01" }),
      seed_urls_raw: ["https://example.com/a", "https://maps.example.com/b?x=1"]
    })
  });

  const response = await route.POST(request);
  const body = (await response.json()) as { ok?: boolean; run_id?: string };
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(typeof body.run_id, "string");

  const runId = body.run_id as string;
  const indexPath = path.join(evidenceDir, runId, "index.json");
  const indexText = await readFile(indexPath, "utf8");
  const index = JSON.parse(indexText) as {
    run_id: string;
    artifacts: Array<{ id: string; kind: string; sha256: string; bytes: number }>;
  };

  assert.equal(index.run_id, runId);
  assert.ok(index.artifacts.length >= 2);
  assert.ok(index.artifacts.some((artifact) => artifact.kind === "inputs_summary"));
  assert.ok(index.artifacts.some((artifact) => artifact.kind === "gating"));
  for (const artifact of index.artifacts) {
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    const artifactPath = path.join(evidenceDir, runId, `${artifact.id}.json`);
    const artifactText = await readFile(artifactPath, "utf8");
    assert.equal(artifactText.includes("http://"), false);
    assert.equal(artifactText.includes("https://"), false);
    assert.equal(artifactText.includes("/Users/"), false);
    assert.equal(artifactText.includes(".bax/runlogs"), false);
  }
});

test("decision_trace is deterministic and references existing evidence artifacts", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const route = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const { deriveRunLogServerFields } = await importFresh<{
    deriveRunLogServerFields: (runlog: ReturnType<typeof createRunLogFixture>) => ReturnType<typeof createRunLogFixture>;
  }>("src/lib/radiography/runlogUtils.ts");

  const request = new Request("http://localhost/api/radiography/runlog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runlog: createRunLogFixture({
        run_id: "run-trace1",
        reason_codes: ["unverified_publish_blocker", "insufficient_core_coverage"],
        blockers: ["unverified_publish_blocker", "insufficient_core_coverage"],
        hard_count: 1,
        warn_count: 1,
        items_count: 2
      }),
      seed_urls_raw: ["https://example.com/landing"]
    })
  });

  const postResponse = await route.POST(request);
  const postBody = (await postResponse.json()) as { ok?: boolean; run_id?: string };
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.ok, true);
  assert.equal(typeof postBody.run_id, "string");

  const runId = postBody.run_id as string;
  const runlogText = await readFile(path.join(runlogDir, `${runId}.json`), "utf8");
  const persistedRunlog = JSON.parse(runlogText) as ReturnType<typeof createRunLogFixture> & {
    decision_trace?: Array<{
      code: string;
      severity: "info" | "warn" | "blocker";
      message: string;
      evidence_refs?: string[];
    }>;
    debug?: { top_blockers?: string[] };
  };

  assert.ok(Array.isArray(persistedRunlog.decision_trace));
  assert.ok((persistedRunlog.decision_trace?.length ?? 0) > 0);

  const regenerated = deriveRunLogServerFields(persistedRunlog);
  assert.deepEqual(regenerated.decision_trace, persistedRunlog.decision_trace);

  const rank = { blocker: 0, warn: 1, info: 2 } as const;
  const trace = persistedRunlog.decision_trace ?? [];
  for (let index = 1; index < trace.length; index += 1) {
    const prev = trace[index - 1];
    const curr = trace[index];
    const prevRank = rank[prev.severity];
    const currRank = rank[curr.severity];
    assert.ok(prevRank <= currRank);
    if (prevRank === currRank) {
      assert.ok(prev.code.localeCompare(curr.code) <= 0);
    }
  }

  for (const blockerCode of persistedRunlog.debug?.top_blockers ?? []) {
    assert.ok(
      trace.some((entry) => entry.code === blockerCode && entry.severity === "blocker"),
      `missing blocker decision trace for ${blockerCode}`
    );
  }

  const evidenceIndex = JSON.parse(
    await readFile(path.join(evidenceDir, runId, "index.json"), "utf8")
  ) as {
    artifacts: Array<{ id: string }>;
  };
  const evidenceIds = new Set(evidenceIndex.artifacts.map((artifact) => `evidence:${artifact.id}`));

  for (const entry of trace) {
    for (const evidenceRef of entry.evidence_refs ?? []) {
      assert.ok(evidenceIds.has(evidenceRef), `missing evidence ref ${evidenceRef}`);
    }
  }
});

test("evidence endpoint returns index without path or URL leaks", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const route = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const evidenceRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/route.ts");

  const postRequest = new Request("http://localhost/api/radiography/runlog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runlog: createRunLogFixture({ run_id: "run-evid02" }),
      seed_urls_raw: ["https://example.com/path?a=1"]
    })
  });
  const postResponse = await route.POST(postRequest);
  const postBody = (await postResponse.json()) as { ok?: boolean; run_id?: string };
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.ok, true);
  assert.equal(typeof postBody.run_id, "string");

  const runId = postBody.run_id as string;
  const getResponse = await evidenceRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(getResponse.status, 200);

  const body = (await getResponse.json()) as {
    ok?: boolean;
    evidence_index?: unknown;
  };
  assert.equal(body.ok, true);

  const bodyText = JSON.stringify(body);
  assert.equal(bodyText.includes("/Users/"), false);
  assert.equal(bodyText.includes("\\\\Users\\\\"), false);
  assert.equal(bodyText.includes(".bax/runlogs"), false);
  assert.equal(bodyText.includes("http://"), false);
  assert.equal(bodyText.includes("https://"), false);
});

test("evidence artifact endpoint returns sanitized artifact without leaks", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const artifactRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string; artifact_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/artifact/[artifact_id]/route.ts");

  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: "run-artf01" }),
        seed_urls_raw: ["https://example.com/path?a=1"]
      })
    })
  );
  const postBody = (await postResponse.json()) as { ok?: boolean; run_id?: string };
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.ok, true);
  assert.equal(typeof postBody.run_id, "string");

  const runId = postBody.run_id as string;
  const index = JSON.parse(
    await readFile(path.join(evidenceDir, runId, "index.json"), "utf8")
  ) as {
    artifacts: Array<{ id: string; kind: string }>;
  };
  const artifact = index.artifacts.find((item) => item.kind === "inputs_summary");
  assert.ok(artifact);

  const response = await artifactRoute.GET(
    new Request(
      `http://localhost/api/radiography/runlog/evidence/${runId}/artifact/${artifact.id}`
    ),
    { params: Promise.resolve({ run_id: runId, artifact_id: artifact.id }) }
  );
  assert.equal(response.status, 200);

  const body = (await response.json()) as {
    ok?: boolean;
    artifact?: {
      id: string;
      kind: string;
      content: Record<string, unknown>;
    };
  };
  assert.equal(body.ok, true);
  assert.equal(body.artifact?.id, artifact.id);
  assert.equal(body.artifact?.kind, "inputs_summary");
  assert.equal(typeof body.artifact?.content, "object");
  assert.ok(body.artifact?.content);

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("/Users/"), false);
  assert.equal(serialized.includes("\\\\Users\\\\"), false);
  assert.equal(serialized.includes(".bax/runlogs"), false);
  assert.equal(serialized.includes("http://"), false);
  assert.equal(serialized.includes("https://"), false);
});

test("evidence artifact endpoint detects integrity mismatch", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const artifactRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string; artifact_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/artifact/[artifact_id]/route.ts");

  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: "run-artf02" }),
        seed_urls_raw: ["https://example.com"]
      })
    })
  );
  const postBody = (await postResponse.json()) as { ok?: boolean; run_id?: string };
  assert.equal(postResponse.status, 200);
  assert.equal(postBody.ok, true);
  assert.equal(typeof postBody.run_id, "string");

  const runId = postBody.run_id as string;
  const index = JSON.parse(
    await readFile(path.join(evidenceDir, runId, "index.json"), "utf8")
  ) as { artifacts: Array<{ id: string; kind: string }> };
  const artifact = index.artifacts.find((item) => item.kind === "gating");
  assert.ok(artifact);

  const artifactPath = path.join(evidenceDir, runId, `${artifact.id}.json`);
  await writeFile(artifactPath, "{\"tampered\":true}\n", "utf8");

  const response = await artifactRoute.GET(
    new Request(
      `http://localhost/api/radiography/runlog/evidence/${runId}/artifact/${artifact.id}`
    ),
    { params: Promise.resolve({ run_id: runId, artifact_id: artifact.id }) }
  );

  assert.equal(response.status, 409);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, "integrity_mismatch");
});

test("evidence artifact endpoint rejects non-json artifact with artifact_not_json", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const artifactRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string; artifact_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/artifact/[artifact_id]/route.ts");

  const runId = "run-nonjs1";
  const artifactId = "inputs_summary-abcd1234";
  const runDir = path.join(evidenceDir, runId);
  await mkdir(runDir, { recursive: true });

  const artifactText = "not json content\n";
  const sha = createHash("sha256").update(artifactText, "utf8").digest("hex");
  const bytes = Buffer.byteLength(artifactText, "utf8");

  await writeFile(path.join(runDir, `${artifactId}.json`), artifactText, "utf8");
  await writeFile(
    path.join(runDir, "index.json"),
    `${JSON.stringify(
      {
        run_id: runId,
        created_at: "2026-02-16T00:00:00.000Z",
        artifacts: [
          {
            id: artifactId,
            kind: "inputs_summary",
            sha256: sha,
            bytes,
            created_at: "2026-02-16T00:00:00.000Z"
          }
        ]
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const response = await artifactRoute.GET(
    new Request(
      `http://localhost/api/radiography/runlog/evidence/${runId}/artifact/${artifactId}`
    ),
    { params: Promise.resolve({ run_id: runId, artifact_id: artifactId }) }
  );

  assert.equal(response.status, 422);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, "artifact_not_json");
});

test("evidence bundle export is deterministic and includes expected artifact ids without leaks", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");

  const runId = "run-bundle1";
  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/path"]
      })
    })
  );
  assert.equal(postResponse.status, 200);

  const responseA = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(responseA.status, 200);
  assert.equal(
    responseA.headers.get("content-type"),
    "application/json; charset=utf-8"
  );
  assert.equal(
    responseA.headers.get("content-disposition"),
    `attachment; filename=\"radiography-evidence-${runId}.json\"`
  );

  const textA = await responseA.text();
  const bundleA = JSON.parse(textA) as {
    bundle_version: string;
    run_id: string;
    evidence_index: { artifacts: Array<{ id: string }> };
    artifacts: Array<{ id: string }>;
  };
  assert.equal(bundleA.bundle_version, "0.1.0");
  assert.equal(bundleA.run_id, runId);
  assert.deepEqual(
    bundleA.artifacts.map((artifact) => artifact.id),
    bundleA.evidence_index.artifacts.map((artifact) => artifact.id)
  );

  const responseB = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(responseB.status, 200);
  const textB = await responseB.text();
  assert.equal(textA, textB);

  assertNoLeakPatterns(textA);
});

test("evidence bundle export fails on integrity mismatch when artifact is tampered", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");

  const runId = "run-bundle2";
  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/path"]
      })
    })
  );
  assert.equal(postResponse.status, 200);

  const index = JSON.parse(
    await readFile(path.join(evidenceDir, runId, "index.json"), "utf8")
  ) as {
    artifacts: Array<{ id: string }>;
  };
  const artifactId = index.artifacts[0]?.id;
  assert.ok(artifactId);
  await writeFile(path.join(evidenceDir, runId, `${artifactId}.json`), "{\"tampered\":true}\n", "utf8");

  const response = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(response.status, 409);
  const body = (await response.json()) as { ok?: boolean; error?: string; artifact_id?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, "integrity_mismatch");
  assert.equal(body.artifact_id, artifactId);
});

test("evidence bundle import supports round-trip with index/artifact/bundle retrieval", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const importRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/import/route.ts"
  );
  const runlogListRoute = await importFresh<{
    GET: (request: Request) => Promise<Response>;
  }>("src/app/api/radiography/runlog/route.ts");
  const runlogByIdRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/[run_id]/route.ts");
  const indexRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/route.ts");
  const artifactRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string; artifact_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/artifact/[artifact_id]/route.ts");

  const runId = "run-bundle3";
  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/path"]
      })
    })
  );
  assert.equal(postResponse.status, 200);

  const exportedResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(exportedResponse.status, 200);
  const exportedText = await exportedResponse.text();
  const exportedBundle = JSON.parse(exportedText) as {
    run_id: string;
    created_at: string;
    evidence_index: {
      run_id: string;
      created_at: string;
      artifacts: Array<{ id: string }>;
    };
    artifacts: Array<{ id: string }>;
  };
  assert.equal(exportedBundle.run_id, runId);

  await resetEvidenceDir();

  const importedRunId = "run-bundle3-import";
  exportedBundle.run_id = importedRunId;
  exportedBundle.evidence_index.run_id = importedRunId;

  const importResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: exportedBundle })
    })
  );
  assert.equal(importResponse.status, 200);
  const importBody = (await importResponse.json()) as {
    ok?: boolean;
    error?: string;
    run_id?: string;
    imported?: { artifacts: number };
  };
  assert.equal(importBody.ok, true);
  assert.equal(importBody.run_id, importedRunId);
  assert.equal(importBody.imported?.artifacts, exportedBundle.artifacts.length);
  assertNoLeakPatterns(JSON.stringify(importBody));

  const listResponse = await runlogListRoute.GET(
    new Request("http://localhost/api/radiography/runlog?limit=20")
  );
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok?: boolean;
    items?: Array<{
      run_id: string;
      source?: string;
      is_stub?: boolean;
    }>;
  };
  assert.equal(listBody.ok, true);
  assert.ok(Array.isArray(listBody.items));
  const importedSummary = listBody.items?.find((item) => item.run_id === importedRunId);
  assert.ok(importedSummary);
  assert.equal(importedSummary?.source, "imported_bundle");
  assert.equal(importedSummary?.is_stub, true);
  assertNoLeakPatterns(JSON.stringify(listBody));

  const byIdResponse = await runlogByIdRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/${importedRunId}`),
    { params: Promise.resolve({ run_id: importedRunId }) }
  );
  assert.equal(byIdResponse.status, 200);
  const byIdBody = (await byIdResponse.json()) as {
    ok?: boolean;
    runlog?: {
      run_id: string;
      source?: string;
      is_stub?: boolean;
      imported_from?: { bundle_version: string };
      outputs: {
        gating_decision: {
          status: string;
          core_percent: number;
          reason_codes: string[];
        };
      };
    };
  };
  assert.equal(byIdBody.ok, true);
  assert.equal(byIdBody.runlog?.run_id, importedRunId);
  assert.equal(byIdBody.runlog?.source, "imported_bundle");
  assert.equal(byIdBody.runlog?.is_stub, true);
  assert.equal(byIdBody.runlog?.imported_from?.bundle_version, "0.1.0");
  assert.equal(byIdBody.runlog?.outputs.gating_decision.status, "soft_fail");
  assert.equal(byIdBody.runlog?.outputs.gating_decision.core_percent, 50);
  assert.deepEqual(byIdBody.runlog?.outputs.gating_decision.reason_codes, ["needs_manual_verify"]);
  assertNoLeakPatterns(JSON.stringify(byIdBody));

  const indexResponse = await indexRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${importedRunId}`),
    { params: Promise.resolve({ run_id: importedRunId }) }
  );
  assert.equal(indexResponse.status, 200);

  const firstArtifactId = exportedBundle.artifacts[0]?.id;
  assert.ok(firstArtifactId);

  const artifactResponse = await artifactRoute.GET(
    new Request(
      `http://localhost/api/radiography/runlog/evidence/${importedRunId}/artifact/${firstArtifactId}`
    ),
    { params: Promise.resolve({ run_id: importedRunId, artifact_id: firstArtifactId }) }
  );
  assert.equal(artifactResponse.status, 200);
  const artifactBodyText = JSON.stringify(await artifactResponse.json());
  assertNoLeakPatterns(artifactBodyText);

  const reExportResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${importedRunId}/bundle`),
    { params: Promise.resolve({ run_id: importedRunId }) }
  );
  assert.equal(reExportResponse.status, 200);
  const reExportText = await reExportResponse.text();
  const expectedReExportText = `${JSON.stringify(exportedBundle, null, 2)}\n`;
  assert.equal(reExportText, expectedReExportText);
});

test("evidence bundle import returns 409 when run_id already exists (full runlog or stub)", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const importRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/import/route.ts"
  );

  const fullRunId = "run-collision-full";
  const fullPost = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: fullRunId }),
        seed_urls_raw: ["https://example.com/full"]
      })
    })
  );
  assert.equal(fullPost.status, 200);

  const fullBundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${fullRunId}/bundle`),
    { params: Promise.resolve({ run_id: fullRunId }) }
  );
  assert.equal(fullBundleResponse.status, 200);
  const fullBundle = JSON.parse(await fullBundleResponse.text()) as unknown;

  const fullImportResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: fullBundle })
    })
  );
  assert.equal(fullImportResponse.status, 409);
  const fullImportBody = (await fullImportResponse.json()) as {
    ok?: boolean;
    error?: string;
  };
  assert.equal(fullImportBody.ok, false);
  assert.equal(fullImportBody.error, "run_already_exists");

  const sourceRunId = "run-collision-source";
  const sourcePost = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: sourceRunId }),
        seed_urls_raw: ["https://example.com/source"]
      })
    })
  );
  assert.equal(sourcePost.status, 200);

  const sourceBundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${sourceRunId}/bundle`),
    { params: Promise.resolve({ run_id: sourceRunId }) }
  );
  assert.equal(sourceBundleResponse.status, 200);
  const sourceBundle = JSON.parse(await sourceBundleResponse.text()) as {
    run_id: string;
    evidence_index: {
      run_id: string;
    };
  };

  const stubRunId = "run-collision-stub";
  sourceBundle.run_id = stubRunId;
  sourceBundle.evidence_index.run_id = stubRunId;

  await resetEvidenceDir();

  const firstStubImportResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: sourceBundle })
    })
  );
  assert.equal(firstStubImportResponse.status, 200);

  const secondStubImportResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: sourceBundle })
    })
  );
  assert.equal(secondStubImportResponse.status, 409);
  const secondStubBody = (await secondStubImportResponse.json()) as {
    ok?: boolean;
    error?: string;
  };
  assert.equal(secondStubBody.ok, false);
  assert.equal(secondStubBody.error, "run_already_exists");
});

test("imported runlog stub defaults gating when gating artifact is missing", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const importRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/import/route.ts"
  );
  const runlogByIdRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/[run_id]/route.ts");
  const runlogListRoute = await importFresh<{
    GET: (request: Request) => Promise<Response>;
  }>("src/app/api/radiography/runlog/route.ts");

  const runId = "run-stub-default";
  const artifactId = "inputs_summary-d1f09a1b";
  const content = {
    business_name: "IMPORTED_BUNDLE",
    city: "UNKNOWN",
    country: "UNKNOWN",
    language: "es",
    mode_hint: "lead",
    seed_urls: {
      count: 0,
      unique_hosts: [],
      url_hashes: []
    }
  };
  const contentText = `${JSON.stringify(content, null, 2)}\n`;
  const sha = createHash("sha256").update(contentText, "utf8").digest("hex");
  const bytes = Buffer.byteLength(contentText, "utf8");

  const bundle = {
    bundle_version: "0.1.0",
    run_id: runId,
    created_at: "2026-02-16T00:00:00.000Z",
    evidence_index: {
      run_id: runId,
      created_at: "2026-02-16T00:00:00.000Z",
      artifacts: [
        {
          id: artifactId,
          kind: "inputs_summary",
          sha256: sha,
          bytes,
          created_at: "2026-02-16T00:00:00.000Z"
        }
      ]
    },
    artifacts: [
      {
        id: artifactId,
        kind: "inputs_summary",
        sha256: sha,
        bytes,
        created_at: "2026-02-16T00:00:00.000Z",
        content
      }
    ]
  };

  const importResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle })
    })
  );
  assert.equal(importResponse.status, 200);

  const byIdResponse = await runlogByIdRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/${runId}`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(byIdResponse.status, 200);
  const byIdBody = (await byIdResponse.json()) as {
    ok?: boolean;
    runlog?: {
      source?: string;
      is_stub?: boolean;
      outputs: {
        gating_decision: {
          status: string;
          core_percent: number;
          reason_codes: string[];
        };
      };
    };
  };
  assert.equal(byIdBody.ok, true);
  assert.equal(byIdBody.runlog?.source, "imported_bundle");
  assert.equal(byIdBody.runlog?.is_stub, true);
  assert.equal(byIdBody.runlog?.outputs.gating_decision.status, "hard_fail");
  assert.equal(byIdBody.runlog?.outputs.gating_decision.core_percent, 0);
  assert.deepEqual(byIdBody.runlog?.outputs.gating_decision.reason_codes, []);
  assertNoLeakPatterns(JSON.stringify(byIdBody));

  const listResponse = await runlogListRoute.GET(
    new Request("http://localhost/api/radiography/runlog?limit=20")
  );
  assert.equal(listResponse.status, 200);
  const listBodyText = JSON.stringify(await listResponse.json());
  assertNoLeakPatterns(listBodyText);
});

test("evidence bundle import rejects traversal, oversized payload, and non-json artifacts", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const importRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/import/route.ts"
  );

  const traversalResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bundle: {
          bundle_version: "0.1.0",
          run_id: "../escape",
          created_at: "2026-02-16T00:00:00.000Z",
          evidence_index: {
            run_id: "../escape",
            created_at: "2026-02-16T00:00:00.000Z",
            artifacts: []
          },
          artifacts: []
        }
      })
    })
  );
  assert.equal(traversalResponse.status, 400);
  const traversalBody = (await traversalResponse.json()) as { ok?: boolean; error?: string };
  assert.equal(traversalBody.ok, false);
  assert.equal(traversalBody.error, "invalid");

  const oversizedContent = { payload: "x".repeat(600_000) };
  const oversizedText = `${JSON.stringify(oversizedContent, null, 2)}\n`;
  const oversizedSha = createHash("sha256").update(oversizedText, "utf8").digest("hex");
  const oversizedBytes = Buffer.byteLength(oversizedText, "utf8");
  const oversizedArtifactId = "inputs_summary-oversized0";
  const oversizedBundle = {
    bundle_version: "0.1.0",
    run_id: "runoversized1",
    created_at: "2026-02-16T00:00:00.000Z",
    evidence_index: {
      run_id: "runoversized1",
      created_at: "2026-02-16T00:00:00.000Z",
      artifacts: [
        {
          id: oversizedArtifactId,
          kind: "inputs_summary",
          sha256: oversizedSha,
          bytes: oversizedBytes,
          created_at: "2026-02-16T00:00:00.000Z"
        }
      ]
    },
    artifacts: [
      {
        id: oversizedArtifactId,
        kind: "inputs_summary",
        sha256: oversizedSha,
        bytes: oversizedBytes,
        created_at: "2026-02-16T00:00:00.000Z",
        content: oversizedContent
      }
    ]
  };

  const oversizedResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: oversizedBundle })
    })
  );
  assert.equal(oversizedResponse.status, 413);
  const oversizedBody = (await oversizedResponse.json()) as { ok?: boolean; error?: string };
  assert.equal(oversizedBody.ok, false);
  assert.equal(oversizedBody.error, "bundle_too_large");

  const nonJsonArtifactId = "gating-nonjson0";
  const nonJsonResponse = await importRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bundle: {
          bundle_version: "0.1.0",
          run_id: "runnonjson1",
          created_at: "2026-02-16T00:00:00.000Z",
          evidence_index: {
            run_id: "runnonjson1",
            created_at: "2026-02-16T00:00:00.000Z",
            artifacts: [
              {
                id: nonJsonArtifactId,
                kind: "gating",
                sha256: "55fbec8f56f51d88f3f3a3fef1e57047f6f50f794f1846fcbfbe0e03ec2f1a6d",
                bytes: 25,
                created_at: "2026-02-16T00:00:00.000Z"
              }
            ]
          },
          artifacts: [
            {
              id: nonJsonArtifactId,
              kind: "gating",
              sha256: "55fbec8f56f51d88f3f3a3fef1e57047f6f50f794f1846fcbfbe0e03ec2f1a6d",
              bytes: 25,
              created_at: "2026-02-16T00:00:00.000Z",
              content: "not-json-object"
            }
          ]
        }
      })
    })
  );
  assert.equal(nonJsonResponse.status, 422);
  const nonJsonBody = (await nonJsonResponse.json()) as { ok?: boolean; error?: string };
  assert.equal(nonJsonBody.ok, false);
  assert.equal(nonJsonBody.error, "artifact_not_json");
});

test("evidence replay returns deterministic output with match=true for untampered bundle", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const replayRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/replay/route.ts"
  );

  const runId = "run-replay1";
  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({
          run_id: runId,
          status: "soft_fail",
          core_percent: 50,
          reason_codes: ["needs_manual_verify"]
        }),
        seed_urls_raw: ["https://example.com/replay"]
      })
    })
  );
  assert.equal(postResponse.status, 200);

  const bundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(bundleResponse.status, 200);
  const bundle = JSON.parse(await bundleResponse.text()) as unknown;

  const makeReplayRequest = () =>
    replayRoute.POST(
      new Request("http://localhost/api/radiography/runlog/evidence/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle })
      })
    );

  const replayA = await makeReplayRequest();
  assert.equal(replayA.status, 200);
  const bodyA = (await replayA.json()) as {
    ok?: boolean;
    replay?: {
      run_id: string;
      gating_decision: {
        status: string;
        core_percent: number;
        reason_codes: string[];
      };
    };
    compare?: {
      baseline_run_id: string;
      match: boolean;
      baseline: {
        status: string;
        core_percent: number;
        reason_codes: string[];
      };
      diff: {
        integrity_warnings: string[];
      };
    };
  };
  assert.equal(bodyA.ok, true);
  assert.equal(typeof bodyA.replay?.run_id, "string");
  assert.equal(bodyA.compare?.baseline_run_id, runId);
  assert.equal(bodyA.compare?.match, true);
  assert.equal(bodyA.compare?.diff.integrity_warnings.length, 0);
  assert.equal(bodyA.replay?.gating_decision.status, bodyA.compare?.baseline.status);
  assert.equal(
    bodyA.replay?.gating_decision.core_percent,
    bodyA.compare?.baseline.core_percent
  );
  assert.deepEqual(
    bodyA.replay?.gating_decision.reason_codes,
    bodyA.compare?.baseline.reason_codes
  );
  assert.equal(EvidenceReplayResponseV0Schema.safeParse(bodyA).success, true);
  assertNoLeakPatterns(JSON.stringify(bodyA));

  const replayB = await makeReplayRequest();
  assert.equal(replayB.status, 200);
  const bodyB = (await replayB.json()) as unknown;
  assert.deepEqual(bodyB, bodyA);
});

test("evidence replay returns leak-safe contract_violation details on internal schema mismatch", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const replayRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/replay/route.ts"
  );

  const runId = "run-replay-contract-violation";
  const postResponse = await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/replay-contract"]
      })
    })
  );
  assert.equal(postResponse.status, 200);

  const bundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(bundleResponse.status, 200);
  const bundle = JSON.parse(await bundleResponse.text()) as unknown;

  const schemaMutable = EvidenceReplayResponseV0Schema as unknown as {
    safeParse: (...args: unknown[]) => unknown;
  };
  const originalSafeParse = schemaMutable.safeParse;
  schemaMutable.safeParse = () => ({
    success: false,
    error: {
      issues: [
        { code: "custom", path: ["replay", "run_id"], message: "x" },
        { code: "custom", path: ["compare", "baseline_run_id"], message: "x" },
        { code: "custom", path: [0, "x"], message: "x" },
        { code: "custom", path: ["compare", "diff"], message: "x" },
        { code: "custom", path: [], message: "x" }
      ]
    }
  });

  try {
    const replayResponse = await replayRoute.POST(
      new Request("http://localhost/api/radiography/runlog/evidence/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bundle })
      })
    );
    assert.equal(replayResponse.status, 500);
    const replayBody = (await replayResponse.json()) as {
      ok?: boolean;
      error?: string;
      details?: {
        code?: string;
        issues_count?: number;
        issues_paths?: string[];
      };
    };
    assert.equal(replayBody.ok, false);
    assert.equal(replayBody.error, "internal_error");
    assert.equal(replayBody.details?.code, "contract_violation");
    assert.equal(replayBody.details?.issues_count, 5);
    assert.deepEqual(replayBody.details?.issues_paths, ["compare", "replay", "root"]);
    assert.equal(
      (replayBody.details?.issues_paths ?? []).every((pathKey) =>
        ["root", "replay", "compare", "persisted"].includes(pathKey)
      ),
      true
    );
    assertNoLeakPatterns(JSON.stringify(replayBody));
  } finally {
    schemaMutable.safeParse = originalSafeParse;
  }
});

test("evidence replay strict mode fails with 409 integrity_mismatch when bundle is tampered", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const replayRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/replay/route.ts"
  );

  const runId = "run-replay2";
  await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/replay-2"]
      })
    })
  );

  const bundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(bundleResponse.status, 200);

  const tamperedBundle = JSON.parse(await bundleResponse.text()) as {
    artifacts: Array<{
      kind: string;
      content: Record<string, unknown>;
    }>;
  };

  const gatingArtifact = tamperedBundle.artifacts.find((artifact) => artifact.kind === "gating");
  assert.ok(gatingArtifact);
  gatingArtifact.content = {
    ...(gatingArtifact.content ?? {}),
    core_percent: 99
  };

  const replayResponse = await replayRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bundle: tamperedBundle })
    })
  );
  assert.equal(replayResponse.status, 409);
  const replayBody = (await replayResponse.json()) as {
    ok?: boolean;
    error?: string;
    details?: { code?: string; artifact_id?: string };
  };
  assert.equal(replayBody.ok, false);
  assert.equal(replayBody.error, "integrity_mismatch");
  assert.equal(typeof replayBody.details?.code, "string");
  assertNoLeakPatterns(JSON.stringify(replayBody));
});

test("runlog by id returns 404 not_found with unified error shape", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogByIdRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/[run_id]/route.ts");

  const response = await runlogByIdRoute.GET(
    new Request("http://localhost/api/radiography/runlog/missing01"),
    { params: Promise.resolve({ run_id: "missing01" }) }
  );

  assert.equal(response.status, 404);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, "not_found");
});

test("runlog by id returns 400 invalid with unified error shape", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogByIdRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/[run_id]/route.ts");

  const response = await runlogByIdRoute.GET(
    new Request("http://localhost/api/radiography/runlog/.."),
    { params: Promise.resolve({ run_id: ".." }) }
  );

  assert.equal(response.status, 400);
  const body = (await response.json()) as { ok?: boolean; error?: string };
  assert.equal(body.ok, false);
  assert.equal(body.error, "invalid");
});

test("evidence replay no-strict mode succeeds with warnings and match=false", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const replayRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/replay/route.ts"
  );

  const runId = "run-replay3";
  await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: runId }),
        seed_urls_raw: ["https://example.com/replay-3"]
      })
    })
  );

  const bundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${runId}/bundle`),
    { params: Promise.resolve({ run_id: runId }) }
  );
  assert.equal(bundleResponse.status, 200);

  const tamperedBundle = JSON.parse(await bundleResponse.text()) as {
    artifacts: Array<{
      kind: string;
      content: Record<string, unknown>;
    }>;
  };
  const inputsArtifact = tamperedBundle.artifacts.find(
    (artifact) => artifact.kind === "inputs_summary"
  );
  assert.ok(inputsArtifact);
  inputsArtifact.content = {
    ...(inputsArtifact.content ?? {}),
    city: "PLACEHOLDER: MONTERREY"
  };

  const replayResponse = await replayRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bundle: tamperedBundle,
        options: {
          strict: false
        }
      })
    })
  );
  assert.equal(replayResponse.status, 200);
  const replayBody = (await replayResponse.json()) as {
    ok?: boolean;
    compare?: {
      match: boolean;
      diff: {
        integrity_warnings: string[];
      };
    };
    replay?: {
      gating_decision: {
        status: string;
      };
    };
  };
  assert.equal(replayBody.ok, true);
  assert.equal(replayBody.compare?.match, false);
  assert.ok((replayBody.compare?.diff.integrity_warnings.length ?? 0) >= 1);
  assert.equal(replayBody.replay?.gating_decision.status, "soft_fail");
  assertNoLeakPatterns(JSON.stringify(replayBody));
});

test("evidence replay persist_stub writes portable_replay stub and returns 409 on collision", async () => {
  await resetRunlogDir();
  await resetEvidenceDir();

  const runlogRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const bundleRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/evidence/[run_id]/bundle/route.ts");
  const replayRoute = await importFresh<{ POST: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/evidence/replay/route.ts"
  );
  const listRoute = await importFresh<{ GET: (request: Request) => Promise<Response> }>(
    "src/app/api/radiography/runlog/route.ts"
  );
  const byIdRoute = await importFresh<{
    GET: (
      request: Request,
      context: { params: Promise<{ run_id: string }> }
    ) => Promise<Response>;
  }>("src/app/api/radiography/runlog/[run_id]/route.ts");

  const sourceRunId = "run-replay4-src";
  await runlogRoute.POST(
    new Request("http://localhost/api/radiography/runlog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runlog: createRunLogFixture({ run_id: sourceRunId }),
        seed_urls_raw: ["https://example.com/replay-4"]
      })
    })
  );

  const bundleResponse = await bundleRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/evidence/${sourceRunId}/bundle`),
    { params: Promise.resolve({ run_id: sourceRunId }) }
  );
  assert.equal(bundleResponse.status, 200);

  const bundle = JSON.parse(await bundleResponse.text()) as {
    run_id: string;
    evidence_index: {
      run_id: string;
    };
  };
  const replayRunId = "runreplaystub1";
  bundle.run_id = replayRunId;
  bundle.evidence_index.run_id = replayRunId;

  const persistResponse = await replayRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bundle,
        options: {
          persist_stub: true,
          run_id: replayRunId
        }
      })
    })
  );
  assert.equal(persistResponse.status, 200);
  const persistBody = (await persistResponse.json()) as {
    ok?: boolean;
    compare?: {
      baseline_run_id?: string;
    };
    persisted?: {
      run_id: string;
      source: string;
      is_stub: boolean;
    };
  };
  assert.equal(persistBody.ok, true);
  assert.equal(persistBody.compare?.baseline_run_id, replayRunId);
  assert.equal(persistBody.persisted?.run_id, replayRunId);
  assert.equal(persistBody.persisted?.source, "portable_replay");
  assert.equal(persistBody.persisted?.is_stub, true);
  assertNoLeakPatterns(JSON.stringify(persistBody));

  const listResponse = await listRoute.GET(
    new Request("http://localhost/api/radiography/runlog?limit=20")
  );
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    ok?: boolean;
    items?: Array<{
      run_id: string;
      source?: string;
      is_stub?: boolean;
    }>;
  };
  assert.equal(listBody.ok, true);
  const replaySummary = listBody.items?.find((item) => item.run_id === replayRunId);
  assert.ok(replaySummary);
  assert.equal(replaySummary?.source, "portable_replay");
  assert.equal(replaySummary?.is_stub, true);
  assertNoLeakPatterns(JSON.stringify(listBody));

  const byIdResponse = await byIdRoute.GET(
    new Request(`http://localhost/api/radiography/runlog/${replayRunId}`),
    { params: Promise.resolve({ run_id: replayRunId }) }
  );
  assert.equal(byIdResponse.status, 200);
  const byIdBody = (await byIdResponse.json()) as {
    ok?: boolean;
    runlog?: { source?: string; is_stub?: boolean };
  };
  assert.equal(byIdBody.ok, true);
  assert.equal(byIdBody.runlog?.source, "portable_replay");
  assert.equal(byIdBody.runlog?.is_stub, true);

  const collisionResponse = await replayRoute.POST(
    new Request("http://localhost/api/radiography/runlog/evidence/replay", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bundle,
        options: {
          persist_stub: true,
          run_id: replayRunId
        }
      })
    })
  );
  assert.equal(collisionResponse.status, 409);
  const collisionBody = (await collisionResponse.json()) as { ok?: boolean; error?: string };
  assert.equal(collisionBody.ok, false);
  assert.equal(collisionBody.error, "run_already_exists");
  assertNoLeakPatterns(JSON.stringify(collisionBody));
});
