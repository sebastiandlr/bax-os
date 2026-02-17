/**
 * Local smoke:
 * export BAX_BASE_URL=http://localhost:3000
 * npm --workspace apps/landing-engine run radiography:runlog -- get run-foo
 * npm --workspace apps/landing-engine run radiography:runlog -- get run-foo --fail=1
 */
import { pathToFileURL } from "node:url";
import { EvidenceReplayResponseV0Schema } from "@bax/radiography-contract";
import { normalizeRunlogResponse, type RunlogApiError } from "../lib/radiography/runlogClient";
import { redactForOperatorView } from "../lib/radiography/redaction";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CliIO = {
  log: (line: string) => void;
  error: (line: string) => void;
};

type CliDeps = {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  io?: CliIO;
};

type CliResult = {
  output: unknown;
};

const defaultIo: CliIO = {
  log: (line) => console.log(line),
  error: (line) => console.error(line)
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const buildRequestUrl = (baseUrl: string, path: string) => {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
};

const printJson = (io: CliIO, value: unknown) => {
  io.log(`${JSON.stringify(redactForOperatorView(value), null, 2)}\n`);
};

const parseFailFlag = (args: string[]) => {
  const failArg = args.find((arg) => arg.startsWith("--fail="));
  if (!failArg) {
    return false;
  }

  const raw = failArg.slice("--fail=".length).trim().toLowerCase();
  return raw === "1" || raw === "true";
};

const stripFailFlag = (args: string[]) => {
  return args.filter((arg) => !arg.startsWith("--fail="));
};

const inferIsErrorOutput = (output: unknown) => {
  return isRecord(output) && output.ok === false;
};

const finalizeWithExitRule = (io: CliIO, output: unknown, failOnError: boolean) => {
  printJson(io, output);
  if (failOnError && inferIsErrorOutput(output)) {
    return 1;
  }
  return 0;
};

const buildCliUnhandledOutput = (message: string) => {
  return {
    ok: false,
    error: "cli_unhandled",
    status: 0,
    correlated: false,
    details: {
      message
    }
  };
};

const buildInvalidArgsOutput = (message: string) => {
  return {
    ok: false,
    error: "invalid",
    status: 0,
    correlated: false,
    errors: [message]
  };
};

const buildNormalizedErrorOutput = (
  response: Response,
  error: RunlogApiError
) => {
  const correlated =
    typeof error.request_id === "string" &&
    typeof error.x_request_id === "string" &&
    error.request_id === error.x_request_id;

  return {
    ok: false,
    status: error.status,
    error: error.error,
    request_id: error.request_id,
    x_request_id: error.x_request_id ?? response.headers.get("x-request-id") ?? undefined,
    correlated,
    ...(error.errors ? { errors: error.errors } : {}),
    ...(error.details !== undefined ? { details: error.details } : {})
  };
};

const requestJson = async (
  fetchImpl: FetchLike,
  url: string,
  init?: RequestInit
): Promise<{ response: Response; body: unknown }> => {
  const response = await fetchImpl(url, init);
  const body = await response.json();
  return { response, body };
};

const handleGetRequest = async (
  fetchImpl: FetchLike,
  mode: "runlog" | "replay",
  url: string
): Promise<CliResult> => {
  const { response, body } = await requestJson(fetchImpl, url);
  const normalized = normalizeRunlogResponse<unknown>(response, body, { mode });

  if (!normalized.ok) {
    return { output: buildNormalizedErrorOutput(response, normalized) };
  }

  return {
    output: {
      ok: true,
      status: response.status,
      x_request_id: response.headers.get("x-request-id"),
      data: normalized.data
    }
  };
};

const parseStrictFlag = (args: string[]) => {
  const strictArg = args.find((arg) => arg.startsWith("--strict="));
  if (!strictArg) {
    return true;
  }
  const raw = strictArg.slice("--strict=".length);
  return raw !== "0";
};

export const runRadiographyRunlogCli = async (
  args: string[],
  deps?: CliDeps
): Promise<number> => {
  const fetchImpl = deps?.fetchImpl ?? (fetch as FetchLike);
  const baseUrl = deps?.baseUrl ?? process.env.BAX_BASE_URL ?? "http://localhost:3000";
  const io = deps?.io ?? defaultIo;
  const failOnError = parseFailFlag(args);
  const parsedArgs = stripFailFlag(args);

  const [command, ...rest] = parsedArgs;
  if (!command) {
    return finalizeWithExitRule(
      io,
      buildInvalidArgsOutput("Usage: radiography-runlog <list|get|evidence|artifact|replay> ..."),
      failOnError
    );
  }

  try {
    if (command === "list") {
      const result = await handleGetRequest(
        fetchImpl,
        "runlog",
        buildRequestUrl(baseUrl, "/api/radiography/runlog?limit=20")
      );
      return finalizeWithExitRule(io, result.output, failOnError);
    }

    if (command === "get") {
      const runId = rest[0];
      if (!runId) {
        return finalizeWithExitRule(
          io,
          buildInvalidArgsOutput("Usage: radiography-runlog get <run_id>"),
          failOnError
        );
      }
      const result = await handleGetRequest(
        fetchImpl,
        "runlog",
        buildRequestUrl(baseUrl, `/api/radiography/runlog/${encodeURIComponent(runId)}`)
      );
      return finalizeWithExitRule(io, result.output, failOnError);
    }

    if (command === "evidence") {
      const runId = rest[0];
      if (!runId) {
        return finalizeWithExitRule(
          io,
          buildInvalidArgsOutput("Usage: radiography-runlog evidence <run_id>"),
          failOnError
        );
      }
      const result = await handleGetRequest(
        fetchImpl,
        "runlog",
        buildRequestUrl(baseUrl, `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}`)
      );
      return finalizeWithExitRule(io, result.output, failOnError);
    }

    if (command === "artifact") {
      const runId = rest[0];
      const artifactId = rest[1];
      if (!runId || !artifactId) {
        return finalizeWithExitRule(
          io,
          buildInvalidArgsOutput("Usage: radiography-runlog artifact <run_id> <artifact_id>"),
          failOnError
        );
      }
      const result = await handleGetRequest(
        fetchImpl,
        "runlog",
        buildRequestUrl(
          baseUrl,
          `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/artifact/${encodeURIComponent(artifactId)}`
        )
      );
      return finalizeWithExitRule(io, result.output, failOnError);
    }

    if (command === "replay") {
      const runId = rest[0];
      if (!runId) {
        return finalizeWithExitRule(
          io,
          buildInvalidArgsOutput("Usage: radiography-runlog replay <run_id> [--strict=0|1]"),
          failOnError
        );
      }

      const strict = parseStrictFlag(rest.slice(1));
      const bundleFetch = await requestJson(
        fetchImpl,
        buildRequestUrl(baseUrl, `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/bundle`)
      );
      const normalizedBundle = normalizeRunlogResponse<unknown>(bundleFetch.response, bundleFetch.body, {
        mode: "runlog"
      });
      if (!normalizedBundle.ok) {
        return finalizeWithExitRule(
          io,
          buildNormalizedErrorOutput(bundleFetch.response, normalizedBundle),
          failOnError
        );
      }

      const replayFetch = await requestJson(
        fetchImpl,
        buildRequestUrl(baseUrl, "/api/radiography/runlog/evidence/replay"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bundle: normalizedBundle.data,
            options: { strict }
          })
        }
      );

      const normalizedReplay = normalizeRunlogResponse<unknown>(replayFetch.response, replayFetch.body, {
        mode: "replay"
      });
      if (!normalizedReplay.ok) {
        return finalizeWithExitRule(
          io,
          buildNormalizedErrorOutput(replayFetch.response, normalizedReplay),
          failOnError
        );
      }

      const parsedReplay = EvidenceReplayResponseV0Schema.safeParse(normalizedReplay.data);
      if (!parsedReplay.success) {
        return finalizeWithExitRule(
          io,
          {
            ok: false,
            status: 500,
            error: "invalid",
            x_request_id: replayFetch.response.headers.get("x-request-id"),
            correlated: false
          },
          failOnError
        );
      }

      return finalizeWithExitRule(
        io,
        {
          ok: true,
          status: replayFetch.response.status,
          x_request_id: replayFetch.response.headers.get("x-request-id"),
          data: parsedReplay.data
        },
        failOnError
      );
    }

    return finalizeWithExitRule(io, buildInvalidArgsOutput(`Unknown command: ${command}`), failOnError);
  } catch {
    return finalizeWithExitRule(io, buildCliUnhandledOutput("Unexpected runtime error."), failOnError);
  }
};

const isEntrypoint = (() => {
  const executedPath = process.argv[1];
  if (!executedPath) {
    return false;
  }
  return import.meta.url === pathToFileURL(executedPath).href;
})();

if (isEntrypoint) {
  void runRadiographyRunlogCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
