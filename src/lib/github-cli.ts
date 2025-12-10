import { spawnSync } from "node:child_process";

/**
 * Check if an error indicates the item was not found (404).
 * Use this to distinguish "not found" (swallowable) from other API errors.
 */
export function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("404") || message.includes("Not Found");
}

/**
 * Execute a GitHub CLI command and return raw stdout.
 * Throws on non-zero exit or spawn error.
 */
export function ghRaw(...arguments_: string[]): string {
  const result = spawnSync("gh", arguments_, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `gh ${arguments_[0] ?? "command"} failed`);
  }
  return result.stdout.trim();
}

/**
 * Execute a GitHub CLI command and parse the JSON output.
 * Generic is intentionally return-only so callers can supply the expected shape.
 * Lint suppression stays because strict config flags return-only generics.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export function ghJson<T>(...arguments_: string[]): T {
  const result = ghRaw(...arguments_);
  try {
    return JSON.parse(result) as T;
  } catch {
    throw new Error(`Failed to parse GitHub CLI output: ${result}`);
  }
}
