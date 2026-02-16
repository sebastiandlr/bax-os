import { NextResponse } from "next/server";
import { z } from "zod";
import { pruneRunLogs } from "@/lib/radiography/runlogStorage";

export const runtime = "nodejs";

const PruneBodySchema = z
  .object({
    maxFiles: z.number().int().min(1).max(2000).optional(),
    maxAgeDays: z.number().int().min(1).max(3650).optional()
  })
  .strict();

const readOptionalJsonBody = async (request: Request): Promise<unknown> => {
  const rawText = await request.text();
  if (!rawText.trim()) {
    return {};
  }
  return JSON.parse(rawText) as unknown;
};

const formatIssues = (
  issues: { path: PropertyKey[]; message: string }[]
) => {
  return issues.map((issue) => {
    const path =
      issue.path.length > 0 ? issue.path.map((segment) => String(segment)).join(".") : "root";
    return `${path}: ${issue.message}`;
  });
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await readOptionalJsonBody(request);
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["body: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  const parsedBody = PruneBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, errors: formatIssues(parsedBody.error.issues) },
      { status: 400 }
    );
  }

  try {
    const result = await pruneRunLogs(parsedBody.data);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prune run logs";
    return NextResponse.json({ ok: false, reason: "error", error: message }, { status: 500 });
  }
}
