import { z } from "zod";

export const BUILD_SPEC_V0_VERSION = "0.1.0" as const;

export const CAPABILITY_IDS_V0 = [
  "hero_identity_block",
  "offer_showcase",
  "primary_transaction",
  "trust_proof",
  "faq_support",
  "lead_capture",
  "location_router",
  "content_engine_stub",
  "analytics_core"
] as const;

const CapabilityIdSchema = z.enum(CAPABILITY_IDS_V0);

export const BuildSpecV0Schema = z.object({
  schemaVersion: z.literal(BUILD_SPEC_V0_VERSION),
  mode: z.enum(["lead", "booking", "quote"]),
  capabilities: z.array(CapabilityIdSchema).min(1).max(9),
  eventSchemaVersion: z.literal("0.1.0"),
  metadata: z
    .object({
      clientId: z.string().min(1).optional(),
      siteId: z.string().min(1).optional()
    })
    .optional()
}).strict().superRefine((value, ctx) => {
  const unique = new Set(value.capabilities);
  if (unique.size !== value.capabilities.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "capabilities must be unique",
      path: ["capabilities"]
    });
  }
});

export type BuildSpecV0 = z.infer<typeof BuildSpecV0Schema>;
export type BuildSpecV0CapabilityId = (typeof CAPABILITY_IDS_V0)[number];

export const parseBuildSpecV0 = (input: unknown): BuildSpecV0 => {
  return BuildSpecV0Schema.parse(input);
};

export const safeParseBuildSpecV0 = (input: unknown) => {
  return BuildSpecV0Schema.safeParse(input);
};

export const isBuildSpecV0 = (input: unknown): input is BuildSpecV0 => {
  return BuildSpecV0Schema.safeParse(input).success;
};
