import { NextResponse } from "next/server";
import { RadiographyRunLogV0Schema } from "@bax/radiography-contract";
import { writeRunLog } from "@/lib/radiography/runlogStorage";

export const runtime = "nodejs";

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
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["runlog: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object" || !("runlog" in body)) {
    return NextResponse.json(
      { ok: false, errors: ["runlog: expected object field"] },
      { status: 400 }
    );
  }

  const runlog = (body as { runlog?: unknown }).runlog;
  const parsed = RadiographyRunLogV0Schema.safeParse(runlog);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, errors: formatIssues(parsed.error.issues) },
      { status: 400 }
    );
  }

  await writeRunLog(parsed.data);
  return NextResponse.json({ ok: true, run_id: parsed.data.run_id });
}
