import { NextResponse } from "next/server";
import { readLatestRunLog } from "@/lib/radiography/runlogStorage";
import {
  buildErrorResponse,
  getRequestId,
  withRequestId
} from "@/lib/radiography/requestId";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const runlog = await readLatestRunLog();
    if (!runlog) {
      return buildErrorResponse({
        requestId,
        status: 404,
        payload: { ok: false, error: "not_found" }
      });
    }
    return withRequestId(NextResponse.json({ ok: true, runlog }), requestId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read latest runlog";
    return buildErrorResponse({
      requestId,
      status: 500,
      payload: { ok: false, error: "error", message }
    });
  }
}
