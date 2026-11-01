export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
