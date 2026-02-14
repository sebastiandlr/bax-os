import "server-only";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import path from "path";
import {
  RadiographyRunLogV0Schema,
  type RadiographyRunLogV0
} from "@bax/radiography-contract";
import { detectLandingEngineRoot } from "@/lib/spec/buildspecStorage";

const APP_ROOT = detectLandingEngineRoot();
const RUNLOG_DIR = path.join(APP_ROOT, ".bax", "runlogs");

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
};

const RUN_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

const ensureRunLogDir = async () => {
  await mkdir(RUNLOG_DIR, { recursive: true });
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
    unique_hosts_count: runlog.inputs.seed_urls.unique_hosts.length
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
  return filePath;
};

const getLatestRunLogFile = async (): Promise<string | null> => {
  const entries = await listRunLogFiles();
  if (entries.length === 0) {
    return null;
  }
  return entries[0]?.filePath ?? null;
};

export const readLatestRunLog = async (): Promise<RadiographyRunLogV0 | null> => {
  const filePath = await getLatestRunLogFile();
  if (!filePath) {
    return null;
  }

  const jsonText = await readFile(filePath, "utf8");
  const parsed = JSON.parse(jsonText) as unknown;
  return RadiographyRunLogV0Schema.parse(parsed);
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
      const runlog = RadiographyRunLogV0Schema.safeParse(parsed);
      if (!runlog.success) {
        continue;
      }
      items.push(toRunLogSummary(runlog.data));
    } catch {
      // Skip invalid or unreadable files; list endpoint should be resilient.
    }
  }

  return items;
};

type ReadRunLogByIdResult =
  | { ok: true; runlog: RadiographyRunLogV0 }
  | { ok: false; reason: "not_found" | "invalid" };

export const readRunLogById = async (run_id: string): Promise<ReadRunLogByIdResult> => {
  if (!RUN_ID_PATTERN.test(run_id)) {
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
    const runlog = RadiographyRunLogV0Schema.safeParse(parsed);
    if (!runlog.success) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, runlog: runlog.data };
  } catch {
    return { ok: false, reason: "invalid" };
  }
};
