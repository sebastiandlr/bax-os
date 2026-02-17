import { NextResponse } from "next/server";
import { computeRunLogDiff, RUNLOG_RUN_ID_PATTERN } from "@/lib/radiography/runlogUtils";
import { readRunLogById } from "@/lib/radiography/runlogStorage";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to || !RUNLOG_RUN_ID_PATTERN.test(from) || !RUNLOG_RUN_ID_PATTERN.test(to)) {
      return buildErrorResponse({
        requestId,
        status: 400,
        payload: { ok: false, error: "invalid" }
      });
    }

    const fromRunlog = await readRunLogById(from);
    const toRunlog = await readRunLogById(to);

    if (!fromRunlog.ok) {
      return buildErrorResponse({
        requestId,
        status: fromRunlog.reason === "not_found" ? 404 : 400,
        payload: {
          ok: false,
          error: fromRunlog.reason === "not_found" ? "not_found" : "invalid"
        }
      });
    }

    if (!toRunlog.ok) {
      return buildErrorResponse({
        requestId,
        status: toRunlog.reason === "not_found" ? 404 : 400,
        payload: {
          ok: false,
          error: toRunlog.reason === "not_found" ? "not_found" : "invalid"
        }
      });
    }

    return withRequestId(NextResponse.json(computeRunLogDiff(fromRunlog.runlog, toRunlog.runlog)), requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to diff runlogs";
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error", message }
    });
  }
}
