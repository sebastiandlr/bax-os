import { pathToFileURL } from "node:url";
import { EvidenceReplayResponseV0Schema } from "@bax/radiography-contract";
import {
  extractRequestIds,
  normalizeRunlogResponse,
  type RunlogApiError
} from "../lib/radiography/runlogClient";
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

const defaultIo: CliIO = {
  log: (line) => console.log(line),
  error: (line) => console.error(line)
};

const buildRequestUrl = (baseUrl: string, path: string) => {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
};

const printJson = (io: CliIO, value: unknown, isError = false) => {
  const serialized = `${JSON.stringify(redactForOperatorView(value), null, 2)}\n`;
  if (isError) {
    io.error(serialized);
    return;
  }
  io.log(serialized);
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
  io: CliIO,
  mode: "runlog" | "replay",
  url: string
) => {
  const { response, body } = await requestJson(fetchImpl, url);
  const normalized = normalizeRunlogResponse<unknown>(response, body, { mode });

  if (!normalized.ok) {
    printJson(io, buildNormalizedErrorOutput(response, normalized), true);
    return 2;
  }

  printJson(io, {
    ok: true,
    status: response.status,
    x_request_id: response.headers.get("x-request-id"),
    data: normalized.data
  });
  return 0;
};

const parseStrictFlag = (args: string[]) => {
  const strictArg = args.find((arg) => arg.startsWith("--strict="));
  if (!strictArg) {
    return true;
  }
  const raw = strictArg.slice("--strict=".length);
  return raw !== "0";
};

const parseCorrelation = (response: Response, body: unknown) => {
  return extractRequestIds(response, body).correlated;
};

export const runRadiographyRunlogCli = async (
  args: string[],
  deps?: CliDeps
): Promise<number> => {
  const fetchImpl = deps?.fetchImpl ?? (fetch as FetchLike);
  const baseUrl = deps?.baseUrl ?? process.env.BAX_BASE_URL ?? "http://localhost:3000";
  const io = deps?.io ?? defaultIo;

  const [command, ...rest] = args;
  if (!command) {
    io.error("Usage: radiography-runlog <list|get|evidence|artifact|replay> ...");
    return 3;
  }

  try {
    if (command === "list") {
      return await handleGetRequest(
        fetchImpl,
        io,
        "runlog",
        buildRequestUrl(baseUrl, "/api/radiography/runlog?limit=20")
      );
    }

    if (command === "get") {
      const runId = rest[0];
      if (!runId) {
        io.error("Usage: radiography-runlog get <run_id>");
        return 3;
      }
      return await handleGetRequest(
        fetchImpl,
        io,
        "runlog",
        buildRequestUrl(baseUrl, `/api/radiography/runlog/${encodeURIComponent(runId)}`)
      );
    }

    if (command === "evidence") {
      const runId = rest[0];
      if (!runId) {
        io.error("Usage: radiography-runlog evidence <run_id>");
        return 3;
      }
      return await handleGetRequest(
        fetchImpl,
        io,
        "runlog",
        buildRequestUrl(baseUrl, `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}`)
      );
    }

    if (command === "artifact") {
      const runId = rest[0];
      const artifactId = rest[1];
      if (!runId || !artifactId) {
        io.error("Usage: radiography-runlog artifact <run_id> <artifact_id>");
        return 3;
      }
      return await handleGetRequest(
        fetchImpl,
        io,
        "runlog",
        buildRequestUrl(
          baseUrl,
          `/api/radiography/runlog/evidence/${encodeURIComponent(runId)}/artifact/${encodeURIComponent(artifactId)}`
        )
      );
    }

    if (command === "replay") {
      const runId = rest[0];
      if (!runId) {
        io.error("Usage: radiography-runlog replay <run_id> [--strict=0|1]");
        return 3;
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
        printJson(io, buildNormalizedErrorOutput(bundleFetch.response, normalizedBundle), true);
        return 2;
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
        const payload = buildNormalizedErrorOutput(replayFetch.response, normalizedReplay);
        printJson(io, { ...payload, correlated: parseCorrelation(replayFetch.response, replayFetch.body) }, true);
        return 2;
      }

      const parsedReplay = EvidenceReplayResponseV0Schema.safeParse(normalizedReplay.data);
      if (!parsedReplay.success) {
        printJson(
          io,
          {
            ok: false,
            status: 500,
            error: "invalid",
            x_request_id: replayFetch.response.headers.get("x-request-id"),
            correlated: false
          },
          true
        );
        return 2;
      }

      printJson(io, {
        ok: true,
        status: replayFetch.response.status,
        x_request_id: replayFetch.response.headers.get("x-request-id"),
        data: parsedReplay.data
      });
      return 0;
    }

    io.error(`Unknown command: ${command}`);
    return 3;
  } catch {
    io.error("Unexpected runtime error.");
    return 3;
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
