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

export const BUILD_SPEC_PATHS = {
  local: LOCAL_PATH,
  example: EXAMPLE_PATH,
} as const;

const isNotFound = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );

const formatErrorMessage = (filePath: string, error: unknown): string => {
  if (error instanceof Error) {
    return `${error.message} (path=${filePath})`;
  }
  return `Unknown filesystem error (path=${filePath})`;
};

const readExampleBuildSpecText = async () => {
  if (!existsSync(EXAMPLE_PATH)) {
    throw new Error(`Example BuildSpec not found at ${EXAMPLE_PATH}`);
  }

  try {
    return await readFile(EXAMPLE_PATH, "utf8");
  } catch (error) {
    throw new Error(formatErrorMessage(EXAMPLE_PATH, error));
  }
};

export const readBuildSpecText = async (): Promise<{
  source: BuildSpecSource;
  jsonText: string;
}> => {
  return readBuildSpecTextWithSource();
};

export const readBuildSpecTextWithSource = async (
  forcedSource?: BuildSpecSource
): Promise<{
  source: BuildSpecSource;
  jsonText: string;
}> => {
  if (forcedSource === "example") {
    const jsonText = await readExampleBuildSpecText();
    return { source: "example", jsonText };
  }

  if (existsSync(LOCAL_PATH)) {
    try {
      const jsonText = await readFile(LOCAL_PATH, "utf8");
      return { source: "local", jsonText };
    } catch (error) {
      throw new Error(formatErrorMessage(LOCAL_PATH, error));
    }
  }

  const jsonText = await readExampleBuildSpecText();
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
