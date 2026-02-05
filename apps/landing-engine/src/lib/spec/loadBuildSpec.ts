import { readFile } from "fs/promises";
import path from "path";
import { parseBuildSpecV0, type BuildSpecV0 } from "@bax/buildspec";

type SpecSource = "local" | "example";

export type LoadResult =
  | { ok: true; spec: BuildSpecV0; source: SpecSource }
  | { ok: false; errors: string[]; source: SpecSource };

const SPEC_DIR = path.join(process.cwd(), "src/content/specs");
const LOCAL_SPEC = path.join(SPEC_DIR, "buildspec.local.json");
const EXAMPLE_SPEC = path.join(SPEC_DIR, "buildspec.v0.example.json");

const isNotFoundError = (error: unknown): boolean => {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ENOENT"
  );
};

const formatIssuePath = (pathParts: Array<string | number>) => {
  if (pathParts.length === 0) {
    return "root";
  }
  return pathParts.join(".");
};

const formatZodErrors = (error: unknown): string[] | null => {
  if (!error || typeof error !== "object" || !("issues" in error)) {
    return null;
  }
  const issues = (error as { issues?: Array<{ path: Array<string | number>; message: string }> })
    .issues;
  if (!issues || issues.length === 0) {
    return null;
  }
  return issues.map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`);
};

const formatReadError = (source: SpecSource, error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown error reading spec file";
  return [`${source} spec read failed: ${message}`];
};

export const loadBuildSpec = async (): Promise<LoadResult> => {
  let source: SpecSource = "local";
  let raw: string;

  try {
    raw = await readFile(LOCAL_SPEC, "utf8");
  } catch (error) {
    if (!isNotFoundError(error)) {
      return { ok: false, source, errors: formatReadError(source, error) };
    }
    source = "example";
    try {
      raw = await readFile(EXAMPLE_SPEC, "utf8");
    } catch (exampleError) {
      return {
        ok: false,
        source,
        errors: formatReadError(source, exampleError),
      };
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid JSON";
    return {
      ok: false,
      source,
      errors: [`${source} spec JSON invalid: ${message}`],
    };
  }

  try {
    const spec = parseBuildSpecV0(parsed);
    return { ok: true, spec, source };
  } catch (error) {
    const zodErrors = formatZodErrors(error);
    if (zodErrors) {
      return { ok: false, source, errors: zodErrors };
    }
    const message = error instanceof Error ? error.message : "Validation failed";
    return { ok: false, source, errors: [message] };
  }
};
