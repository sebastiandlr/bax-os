import { NextResponse } from "next/server";
import { BuildSpecV0Schema } from "@bax/buildspec";
import { formatZodIssues } from "@/lib/spec/formatZodIssues";
import {
  BUILD_SPEC_PATHS,
  deleteLocalBuildSpec,
  readBuildSpecTextWithSource,
  writeLocalBuildSpecText
} from "@/lib/spec/buildspecStorage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const sourceParam = searchParams.get("source");
  const forcedSource = sourceParam === "example" ? "example" : undefined;

  try {
    const { source, jsonText } = await readBuildSpecTextWithSource(forcedSource);
    return NextResponse.json({ source, jsonText });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read BuildSpec";
    return NextResponse.json(
      {
        error: `${message}; attempted local=${BUILD_SPEC_PATHS.local}; attempted example=${BUILD_SPEC_PATHS.example}`
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, errors: ["jsonText: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("jsonText" in body) ||
    typeof (body as { jsonText?: unknown }).jsonText !== "string"
  ) {
    return NextResponse.json(
      { ok: false, errors: ["jsonText: expected string field"] },
      { status: 400 }
    );
  }

  const jsonText = (body as { jsonText: string }).jsonText;
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    return NextResponse.json(
      { ok: false, errors: [`json: ${message}`] },
      { status: 400 }
    );
  }

  const result = BuildSpecV0Schema.safeParse(parsed);
  if (!result.success) {
    return NextResponse.json(
      { ok: false, errors: formatZodIssues(result.error.issues) },
      { status: 400 }
    );
  }

  const formatted = `${JSON.stringify(result.data, null, 2)}\n`;
  await writeLocalBuildSpecText(formatted);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  await deleteLocalBuildSpec();
  return NextResponse.json({ ok: true });
}
