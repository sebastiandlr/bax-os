import { FieldStatusEnum, type FieldStatus } from "@bax/radiography-contract";

export const DISPLAY_RULES_V0_VERSION = "0.1.0" as const;

export const PUBLISH_BLOCKER_FIELDS_V0 = [
  "business_name",
  "city",
  "country",
  "mode",
  "primary_cta"
] as const;

export const shouldShowField = (
  fieldPath: string,
  fieldStatus: FieldStatus
): boolean => {
  if (PUBLISH_BLOCKER_FIELDS_V0.includes(fieldPath as typeof PUBLISH_BLOCKER_FIELDS_V0[number])) {
    return fieldStatus === "verified";
  }
  return true;
};

export const SafeCopyIdEnum = {
  NOT_VERIFIED: "not_verified",
  NEEDS_REVIEW: "needs_review",
  BLOCKED: "blocked"
} as const;
export type SafeCopyId = (typeof SafeCopyIdEnum)[keyof typeof SafeCopyIdEnum];

const SAFE_COPY: Record<string, Record<SafeCopyId, string>> = {
  "en": {
    not_verified: "This field is not verified yet.",
    needs_review: "This item needs manual review.",
    blocked: "This item is blocked from publishing."
  },
  "es": {
    not_verified: "Este campo aún no está verificado.",
    needs_review: "Este elemento requiere revisión manual.",
    blocked: "Este elemento está bloqueado para publicar."
  }
};

export const getSafeCopy = (id: SafeCopyId, locale = "en"): string => {
  const lang = SAFE_COPY[locale] ? locale : "en";
  return SAFE_COPY[lang][id];
};

export const INSTAGRAM_ALLOWLIST_V0 = [
  "identity.brand_name",
  "identity.tone",
  "identity.aesthetic",
  "identity.tagline",
  "identity.keywords"
] as const;

export const FieldStatusEnumV0 = FieldStatusEnum;
