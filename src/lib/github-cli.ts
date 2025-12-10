import { spawnSync } from "node:child_process";
import {
  isRateLimitTrackingEnabled,
  parseIncludeOutput,
  extractRateLimitFromHeaders,
  recordRateLimit,
} from "./rate-limit-tracker.js";

/**
 * Format a command description for rate limit logging.
 *
 * Creates a short, readable label for the breakdown report:
 * - GraphQL calls → "graphql"
 * - REST calls → endpoint path (truncated to 50 chars)
 *
 * @example
 * formatCommandDescription(["api", "graphql", "-f", "query=..."]) → "graphql"
 * formatCommandDescription(["api", "repos/owner/repo/pulls"]) → "repos/owner/repo/pulls"
 */
function formatCommandDescription(arguments_: string[]): string {
  // Skip 'api' (first arg) and examine the rest
  const restArguments = arguments_.slice(1);

  // GraphQL calls all use the same endpoint, so just label them "graphql"
  if (restArguments[0] === "graphql") {
    return "graphql";
  }

  // REST calls: find the endpoint path (first arg that's not a flag)
  const endpoint = restArguments.find(
    (a) => !a.startsWith("-") && !a.startsWith("="),
  );
  if (endpoint) {
    return endpoint.length > 50 ? endpoint.slice(0, 47) + "..." : endpoint;
  }

  // Fallback: show first two args
  return restArguments.slice(0, 2).join(" ");
}

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
 *
 * When rate limit tracking is enabled (--debug-rate-limit flag) and the
 * command is `gh api`, automatically adds `--include` to capture HTTP
 * headers containing rate limit info. The headers are parsed and recorded,
 * then stripped from the output so callers receive only the body.
 */
export function ghRaw(...arguments_: string[]): string {
  const tracking = isRateLimitTrackingEnabled();
  const isApiCall = arguments_[0] === "api";

  // When tracking rate limits, inject --include flag to get HTTP headers
  // in the response. We'll parse them out before returning the body.
  const finalArguments =
    tracking && isApiCall
      ? ["api", "--include", ...arguments_.slice(1)]
      : arguments_;

  const result = spawnSync("gh", finalArguments, {
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024, // 100 MB for large PR responses
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || `gh ${arguments_[0] ?? "command"} failed`);
  }

  let output = result.stdout.trim();

  // When tracking: extract rate limit headers, record them, return body only
  if (tracking && isApiCall) {
    const { headers, body } = parseIncludeOutput(output);
    const snapshot = extractRateLimitFromHeaders(headers);
    if (snapshot) {
      const commandDesc = formatCommandDescription(arguments_);
      recordRateLimit(commandDesc, snapshot);
    }
    // Return body without headers so callers get expected format
    output = body;
  }

  return output;
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
