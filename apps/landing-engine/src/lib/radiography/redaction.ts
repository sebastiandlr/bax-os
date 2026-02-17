const REDACTED_VALUE = "[redacted]";

const FORBIDDEN_KEY_FRAGMENTS = [
  "path",
  "filepath",
  "file_path",
  "url",
  "href",
  "location",
  "stack",
  "trace",
  "token",
  "secret",
  "authorization",
  "cookie"
];

const FORBIDDEN_STRING_PATTERNS = [
  /\/mnt\/\S*/i,
  /file:\/\/\S*/i,
  /https?:\/\/\S*/i,
  /[A-Za-z]:\\\S*/
];

const shouldRemoveKey = (key: string) => {
  const lower = key.toLowerCase();
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
};

const shouldRedactString = (value: string) => {
  return FORBIDDEN_STRING_PATTERNS.some((pattern) => pattern.test(value));
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const redactForOperatorView = (value: unknown): unknown => {
  if (typeof value === "string") {
    return shouldRedactString(value) ? REDACTED_VALUE : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactForOperatorView(item));
  }

  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      if (shouldRemoveKey(key)) {
        continue;
      }
      output[key] = redactForOperatorView(value[key]);
    }
    return output;
  }

  return value;
};

export const toRedactedJson = (value: unknown) => {
  return `${JSON.stringify(redactForOperatorView(value), null, 2)}\n`;
};
