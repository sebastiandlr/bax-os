import { NextResponse } from "next/server";
import { BuildSpecV0Schema } from "@bax/buildspec";
import { formatZodIssues } from "@/lib/spec/formatZodIssues";
import {
  deleteLocalBuildSpec,
  readBuildSpecText,
  writeLocalBuildSpecText
} from "@/lib/spec/buildspecStorage";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { source, jsonText } = await readBuildSpecText();
    return NextResponse.json({ source, jsonText });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read BuildSpec";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const jsonText = await request.text();
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
