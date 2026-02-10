import {
  PUBLISH_BLOCKER_FIELDS_V0,
  type FieldStatusV0
} from "@bax/radiography-contract";

export const DISPLAY_RULES_V0_VERSION = "0.1.0" as const;

export type DisplayDecision = {
  show: boolean;
  reason: "ok" | "requires_verified";
};

type ShouldShowFieldInput = {
  fieldPath: string;
  status: FieldStatusV0;
};

const isPublishBlockerField = (fieldPath: string): boolean => {
  return PUBLISH_BLOCKER_FIELDS_V0.includes(
    fieldPath as (typeof PUBLISH_BLOCKER_FIELDS_V0)[number]
  );
};

export const shouldShowField = ({ fieldPath, status }: ShouldShowFieldInput): boolean => {
  if (isPublishBlockerField(fieldPath)) {
    return status === "verified";
  }
  return status !== "conflict";
};

export const getDisplayDecision = (input: ShouldShowFieldInput): DisplayDecision => {
  const show = shouldShowField(input);
  return {
    show,
    reason: show ? "ok" : "requires_verified"
  };
};

const SAFE_COPY_BY_LANG: Record<string, Record<string, string>> = {
  en: {
    default: "Information hidden until verified.",
    "/contact/phone": "Phone hidden until verified.",
    "/location/address": "Address hidden until verified.",
    "/operations/hours": "Hours hidden until verified.",
    "/offers/pricing": "Pricing hidden until verified.",
    "/claims": "Claims hidden until verified."
  },
  es: {
    default: "Informacion oculta hasta verificar.",
    "/contact/phone": "Telefono oculto hasta verificar.",
    "/location/address": "Direccion oculta hasta verificar.",
    "/operations/hours": "Horario oculto hasta verificar.",
    "/offers/pricing": "Precios ocultos hasta verificar.",
    "/claims": "Afirmaciones ocultas hasta verificar."
  }
};

const normalizeLanguage = (lang: string): "en" | "es" => {
  return lang.toLowerCase().startsWith("es") ? "es" : "en";
};

export const safeCopyFor = (fieldKey: string, lang: string): string => {
  const language = normalizeLanguage(lang);
  return SAFE_COPY_BY_LANG[language][fieldKey] ?? SAFE_COPY_BY_LANG[language].default;
};
