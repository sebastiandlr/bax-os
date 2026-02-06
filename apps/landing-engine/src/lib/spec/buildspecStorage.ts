import { existsSync } from "fs";
import { readFile, writeFile, unlink } from "fs/promises";
import path from "path";

export type BuildSpecSource = "local" | "example";

export const detectLandingEngineRoot = (): string => {
  const cwd = process.cwd();
  const directPath = path.join(cwd, "src", "app");
  if (existsSync(directPath)) {
    return cwd;
  }

  const monorepoPath = path.join(cwd, "apps", "landing-engine", "src", "app");
  if (existsSync(monorepoPath)) {
    return path.join(cwd, "apps", "landing-engine");
  }

  throw new Error(
    `Cannot locate landing-engine root from cwd=${cwd}; expected src/app or apps/landing-engine/src/app`
  );
};

const APP_ROOT = detectLandingEngineRoot();
const LOCAL_PATH = path.join(APP_ROOT, "buildspec.local.json");
const EXAMPLE_PATH = path.join(
  APP_ROOT,
  "src",
  "content",
  "specs",
  "buildspec.v0.example.json"
);

const isNotFound = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );

export const readBuildSpecText = async (): Promise<{
  source: BuildSpecSource;
  jsonText: string;
}> => {
  if (existsSync(LOCAL_PATH)) {
    const jsonText = await readFile(LOCAL_PATH, "utf8");
    return { source: "local", jsonText };
  }

  if (!existsSync(EXAMPLE_PATH)) {
    throw new Error(`Example BuildSpec not found at ${EXAMPLE_PATH}`);
  }

  const jsonText = await readFile(EXAMPLE_PATH, "utf8");
  return { source: "example", jsonText };
};

export const writeLocalBuildSpecText = async (jsonText: string) => {
  await writeFile(LOCAL_PATH, jsonText, "utf8");
};

export const deleteLocalBuildSpec = async () => {
  try {
    await unlink(LOCAL_PATH);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }
};
