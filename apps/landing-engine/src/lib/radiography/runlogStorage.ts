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

const ensureRunLogDir = async () => {
  await mkdir(RUNLOG_DIR, { recursive: true });
};

export const writeRunLog = async (runlog: RadiographyRunLogV0) => {
  await ensureRunLogDir();
  const filePath = path.join(RUNLOG_DIR, `${runlog.run_id}.json`);
  const jsonText = `${JSON.stringify(runlog, null, 2)}\n`;
  await writeFile(filePath, jsonText, "utf8");
  return filePath;
};

const getLatestRunLogFile = async (): Promise<string | null> => {
  await ensureRunLogDir();
  const files = (await readdir(RUNLOG_DIR)).filter((fileName) =>
    fileName.endsWith(".json")
  );

  if (files.length === 0) {
    return null;
  }

  let latestFile: string | null = null;
  let latestMtime = 0;

  for (const fileName of files) {
    const filePath = path.join(RUNLOG_DIR, fileName);
    const fileStat = await stat(filePath);
    if (fileStat.mtimeMs > latestMtime) {
      latestMtime = fileStat.mtimeMs;
      latestFile = filePath;
    }
  }

  return latestFile;
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
