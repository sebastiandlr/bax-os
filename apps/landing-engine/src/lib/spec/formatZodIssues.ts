import type { ZodIssue } from "zod";

export const formatZodIssues = (issues: ZodIssue[]): string[] => {
  return issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
};
