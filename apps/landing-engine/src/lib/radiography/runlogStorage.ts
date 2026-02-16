import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  type RadiographyRunLogV0
} from "@bax/radiography-contract";
import { detectLandingEngineRoot } from "../spec/buildspecStorage";
import {
  parseStoredRunLog,
  RUNLOG_RUN_ID_PATTERN,
  writeEvidencePackForRunLog
} from "./runlogUtils";

const ENV_RUNLOG_DIR = process.env.BAX_RUNLOG_DIR;
const RUNLOG_DIR = ENV_RUNLOG_DIR
  ? path.resolve(ENV_RUNLOG_DIR)
  : path.join(detectLandingEngineRoot(), ".bax", "runlogs");
const RESOLVED_RUNLOG_DIR = path.resolve(RUNLOG_DIR);

export const RUNLOG_PATHS = {
  dir: RUNLOG_DIR
} as const;

type RunLogDirectoryEntry = {
  fileName: string;
  filePath: string;
  mtimeMs: number;
};

export type RunLogSummary = {
  run_id: string;
  created_at: string;
  duration_ms: number;
  status: "pass" | "soft_fail" | "hard_fail" | "blocked";
  core_percent: number;
  reason_codes: string[];
  seed_urls_count: number;
  unique_hosts_count: number;
  source?: "local_run" | "imported_bundle" | "portable_replay";
  is_stub?: boolean;
  top_blockers?: string[];
};

const ensureRunLogDir = async () => {
  await mkdir(RUNLOG_DIR, { recursive: true });
};

const runLogDirExists = async () => {
  try {
    const fileStat = await stat(RUNLOG_DIR);
    return fileStat.isDirectory();
  } catch {
    return false;
  }
};

const isPathInsideRunLogDir = (filePath: string) => {
  const resolvedFilePath = path.resolve(filePath);
  return (
    resolvedFilePath === RESOLVED_RUNLOG_DIR ||
    resolvedFilePath.startsWith(`${RESOLVED_RUNLOG_DIR}${path.sep}`)
  );
};

const toRunLogSummary = (runlog: RadiographyRunLogV0): RunLogSummary => {
  return {
    run_id: runlog.run_id,
    created_at: runlog.created_at,
    duration_ms: runlog.duration_ms,
    status: runlog.outputs.gating_decision.status,
    core_percent: runlog.outputs.gating_decision.core_percent,
    reason_codes: runlog.outputs.gating_decision.reason_codes,
    seed_urls_count: runlog.inputs.seed_urls.count,
    unique_hosts_count: runlog.inputs.seed_urls.unique_hosts.length,
    source: runlog.source ?? "local_run",
    is_stub: runlog.is_stub,
    top_blockers: runlog.debug?.top_blockers
  };
};

const listRunLogFiles = async (): Promise<RunLogDirectoryEntry[]> => {
  await ensureRunLogDir();
  const fileNames = (await readdir(RUNLOG_DIR))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort();

  const entries = await Promise.all(
    fileNames.map(async (fileName): Promise<RunLogDirectoryEntry | null> => {
      const filePath = path.join(RUNLOG_DIR, fileName);
      try {
        const fileStat = await stat(filePath);
        return {
          fileName,
          filePath,
          mtimeMs: fileStat.mtimeMs
        };
      } catch {
        return null;
      }
    })
  );

  return entries
    .filter((entry): entry is RunLogDirectoryEntry => entry !== null)
    .sort((a, b) => b.mtimeMs - a.mtimeMs || a.fileName.localeCompare(b.fileName));
};

export const writeRunLog = async (runlog: RadiographyRunLogV0) => {
  await ensureRunLogDir();
  const filePath = path.join(RUNLOG_DIR, `${runlog.run_id}.json`);
  const jsonText = `${JSON.stringify(runlog, null, 2)}\n`;
  await writeFile(filePath, jsonText, "utf8");
  await writeEvidencePackForRunLog(runlog);
  return filePath;
};

export const readLatestRunLog = async (): Promise<RadiographyRunLogV0 | null> => {
  const entries = await listRunLogFiles();
  for (const entry of entries) {
    try {
      const jsonText = await readFile(entry.filePath, "utf8");
      const parsedJson = JSON.parse(jsonText) as unknown;
      const runlog = parseStoredRunLog(parsedJson);
      if (runlog) {
        return runlog;
      }
    } catch {
      // Skip invalid or unreadable files and continue searching.
    }
  }
  return null;
};

export const listRunLogs = async (limit: number): Promise<RunLogSummary[]> => {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (normalizedLimit === 0) {
    return [];
  }

  const entries = await listRunLogFiles();
  const items: RunLogSummary[] = [];

  for (const entry of entries) {
    if (items.length >= normalizedLimit) {
      break;
    }

    try {
      const jsonText = await readFile(entry.filePath, "utf8");
      const parsed = JSON.parse(jsonText) as unknown;
      const runlog = parseStoredRunLog(parsed);
      if (!runlog) {
        continue;
      }
      items.push(toRunLogSummary(runlog));
    } catch {
      // Skip invalid or unreadable files; list endpoint should be resilient.
    }
  }

  return items;
};

export const pruneRunLogs = async (opts?: {
  maxFiles?: number;
  maxAgeDays?: number;
}): Promise<{ deleted: number; kept: number; scanned: number }> => {
  const maxFiles = opts?.maxFiles ?? 200;
  const maxAgeDays = opts?.maxAgeDays ?? 14;

  const exists = await runLogDirExists();
  if (!exists) {
    return { deleted: 0, kept: 0, scanned: 0 };
  }

  const entries = await listRunLogFiles();
  const scanned = entries.length;
  if (scanned === 0) {
    return { deleted: 0, kept: 0, scanned: 0 };
  }

  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const filePathsToDelete = new Set<string>();

  for (const entry of entries) {
    if (now - entry.mtimeMs > maxAgeMs) {
      filePathsToDelete.add(entry.filePath);
    }
  }

  for (const entry of entries.slice(maxFiles)) {
    filePathsToDelete.add(entry.filePath);
  }

  let deleted = 0;
  for (const filePath of filePathsToDelete) {
    if (!isPathInsideRunLogDir(filePath)) {
      continue;
    }

    try {
      await unlink(filePath);
      deleted += 1;
    } catch {
      // Ignore unlink errors and continue pruning the rest.
    }
  }

  return {
    deleted,
    kept: Math.max(0, scanned - deleted),
    scanned
  };
};

type ReadRunLogByIdResult =
  | { ok: true; runlog: RadiographyRunLogV0 }
  | { ok: false; reason: "not_found" | "invalid" };

export const readRunLogById = async (run_id: string): Promise<ReadRunLogByIdResult> => {
  if (!RUNLOG_RUN_ID_PATTERN.test(run_id)) {
    return { ok: false, reason: "invalid" };
  }

  await ensureRunLogDir();
  const filePath = path.join(RUNLOG_DIR, `${run_id}.json`);

  let jsonText: string;
  try {
    jsonText = await readFile(filePath, "utf8");
  } catch (error) {
    const maybeCode = (error as { code?: string }).code;
    if (maybeCode === "ENOENT") {
      return { ok: false, reason: "not_found" };
    }
    return { ok: false, reason: "invalid" };
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const runlog = parseStoredRunLog(parsed);
    if (!runlog) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, runlog };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};
