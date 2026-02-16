import { BuildSpecV0Schema } from "@bax/buildspec";
import { runRadiographyV0 } from "@bax/radiography-runner";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildRunLogFromRunnerOutput,
  normalizeSeedUrls,
  RUNLOG_RUN_ID_PATTERN
} from "@/lib/radiography/runlogUtils";
import { readRunLogById, writeRunLog } from "@/lib/radiography/runlogStorage";

export const runtime = "nodejs";

const SeedUrlOverrideSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .superRefine((value, ctx) => {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "seed URL must use http or https"
        });
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "seed URL must be a valid URL"
      });
    }
  });

const ReplayBodySchema = z
  .object({
    run_id: z.string().regex(RUNLOG_RUN_ID_PATTERN),
    seed_urls_override: z.array(SeedUrlOverrideSchema).min(1).max(20),
    mode: z.enum(["dry_run", "persist"]).optional().default("persist")
  })
  .strict();

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid", errors: ["body: request body must be valid JSON"] },
      { status: 400 }
    );
  }

  if (!isRecord(body) || !("seed_urls_override" in body)) {
    return NextResponse.json(
      { ok: false, error: "seed_urls_required" },
      { status: 400 }
    );
  }

  const parsedBody = ReplayBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { ok: false, error: "invalid", errors: formatIssues(parsedBody.error.issues) },
      { status: 400 }
    );
  }

  const source = await readRunLogById(parsedBody.data.run_id);
  if (!source.ok) {
    return NextResponse.json(
      { ok: false, error: source.reason },
      { status: source.reason === "not_found" ? 404 : 400 }
    );
  }

  const buildSpec = BuildSpecV0Schema.safeParse(source.runlog.buildspec);
  if (!buildSpec.success) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }

  const normalizedSeedUrls = normalizeSeedUrls(parsedBody.data.seed_urls_override);
  if (normalizedSeedUrls.length === 0) {
    return NextResponse.json(
      { ok: false, error: "seed_urls_required" },
      { status: 400 }
    );
  }

  const output = runRadiographyV0(
    {
      radiography_contract_version: "0.1.0",
      business_name: source.runlog.inputs.business_name,
      city: source.runlog.inputs.city,
      country: source.runlog.inputs.country,
      language: source.runlog.inputs.language,
      mode_hint: source.runlog.inputs.mode_hint,
      seed_urls: normalizedSeedUrls
    },
    buildSpec.data
  );

  const replayedRunlog = buildRunLogFromRunnerOutput({
    output,
    inputContext: {
      business_name: source.runlog.inputs.business_name,
      city: source.runlog.inputs.city,
      country: source.runlog.inputs.country,
      language: source.runlog.inputs.language,
      mode_hint: source.runlog.inputs.mode_hint
    },
    buildspec: buildSpec.data,
    seedUrlsRaw: normalizedSeedUrls
  });

  if (parsedBody.data.mode !== "dry_run") {
    await writeRunLog(replayedRunlog);
  }

  return NextResponse.json({
    ok: true,
    replayed_from: source.runlog.run_id,
    new_run_id: replayedRunlog.run_id,
    runlog: replayedRunlog
  });
}
