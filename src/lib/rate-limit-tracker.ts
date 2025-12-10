/**
 * GitHub API rate limit tracking for debugging.
 *
 * GitHub returns rate limit headers with every API response:
 * - x-ratelimit-limit: Maximum requests per hour
 * - x-ratelimit-remaining: Requests left in current window
 * - x-ratelimit-used: Requests consumed in current window
 * - x-ratelimit-reset: Unix timestamp when the window resets
 * - x-ratelimit-resource: Which quota pool (core, graphql, search)
 *
 * This module parses these headers from `gh api --include` output and tracks
 * consumption across CLI invocations to help debug rate limit issues.
 */

/**
 * GitHub API rate limit resource types.
 * Each has its own quota pool (typically 5000/hour for core and graphql).
 */
type RateLimitResource = "core" | "graphql" | "search" | "other";

/**
 * Snapshot of rate limit state at a point in time.
 */
interface RateLimitSnapshot {
  /** Which quota pool this applies to */
  resource: RateLimitResource;
  /** Maximum requests allowed per hour */
  limit: number;
  /** Requests already consumed in current window */
  used: number;
  /** Requests remaining in current window */
  remaining: number;
  /** Unix timestamp when the quota resets */
  reset: number;
}

/**
 * Record of a single API call's rate limit impact.
 */
interface RateLimitCall {
  /** Short description of the API call (e.g., "graphql" or endpoint path) */
  command: string;
  /** Rate limit state before this call (undefined if first call for resource) */
  before: RateLimitSnapshot | undefined;
  /** Rate limit state after this call */
  after: RateLimitSnapshot;
  /** Number of quota points consumed by this call */
  consumed: number;
}

// Module state (reset on each CLI invocation via enableRateLimitTracking)
let enabled = false;
let lastSnapshot: RateLimitSnapshot | undefined;
const calls: RateLimitCall[] = [];

/**
 * Enable rate limit tracking and reset state.
 * Called at CLI startup when --debug-rate-limit flag is present.
 */
export function enableRateLimitTracking(): void {
  enabled = true;
  lastSnapshot = undefined;
  calls.length = 0;
}

/**
 * Check if rate limit tracking is enabled.
 * Used by {@link ghRaw} to decide whether to add --include flag.
 */
export function isRateLimitTrackingEnabled(): boolean {
  return enabled;
}

/**
 * Parse rate limit headers from `gh api --include` output.
 * Headers are at the start, followed by a blank line, then the body.
 *
 * Returns { headers, body } where headers is a map of lowercase header names.
 */
export function parseIncludeOutput(output: string): {
  headers: Map<string, string>;
  body: string;
} {
  const headers = new Map<string, string>();

  // Find the blank line separating headers from body
  const parts = output.split(/\r?\n\r?\n/u);
  const headerSection = parts[0];
  if (parts.length < 2 || !headerSection) {
    // No headers found, entire output is body
    return { headers, body: output };
  }

  const body = parts.slice(1).join("\n\n");

  // Parse headers (skip first line which is HTTP status)
  const lines = headerSection.split(/\r?\n/u);
  for (const line of lines.slice(1)) {
    const colonIndex = line.indexOf(":");
    if (colonIndex > 0) {
      const name = line.slice(0, colonIndex).toLowerCase().trim();
      const value = line.slice(colonIndex + 1).trim();
      headers.set(name, value);
    }
  }

  return { headers, body };
}

/**
 * Extract rate limit snapshot from parsed headers.
 */
export function extractRateLimitFromHeaders(
  headers: Map<string, string>,
): RateLimitSnapshot | undefined {
  const limit = headers.get("x-ratelimit-limit");
  const used = headers.get("x-ratelimit-used");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const resource = headers.get("x-ratelimit-resource");

  if (!limit || !used || !remaining || !reset) {
    return undefined;
  }

  return {
    resource: (resource ?? "other") as RateLimitResource,
    limit: Number.parseInt(limit),
    used: Number.parseInt(used),
    remaining: Number.parseInt(remaining),
    reset: Number.parseInt(reset),
  };
}

/**
 * Record a rate limit snapshot after an API call.
 *
 * Calculates consumption by comparing the "used" count with the previous
 * snapshot for the same resource. For the first call of a resource type,
 * assumes 1 point consumed (REST API standard).
 *
 * @param command - Short description of the API call for the breakdown report
 * @param snapshot - Rate limit state from response headers
 */
export function recordRateLimit(
  command: string,
  snapshot: RateLimitSnapshot,
): void {
  if (!enabled) return;

  // Only compare with previous snapshot if it's the same resource type
  // (core and graphql have separate quota pools)
  const before =
    lastSnapshot?.resource === snapshot.resource ? lastSnapshot : undefined;

  // Calculate consumed: difference in "used" count between calls
  // For first call of a resource, default to 1 (standard REST cost)
  const consumed = before ? snapshot.used - before.used : 1;

  calls.push({
    command,
    before,
    after: snapshot,
    consumed: Math.max(0, consumed), // Guard against negative (clock skew, etc.)
  });

  lastSnapshot = snapshot;
}

/**
 * Get all recorded rate limit calls.
 */
export function getRateLimitCalls(): readonly RateLimitCall[] {
  return calls;
}

/**
 * Format rate limit summary for display.
 */
export function formatRateLimitSummary(): string {
  if (calls.length === 0) {
    return "No API calls recorded.";
  }

  const lines: string[] = [
    "",
    "─".repeat(60),
    "Rate Limit Usage:",
    "─".repeat(60),
  ];

  // Group by resource
  const byResource = new Map<RateLimitResource, RateLimitCall[]>();
  for (const call of calls) {
    const resource = call.after.resource;
    const existing = byResource.get(resource) ?? [];
    existing.push(call);
    byResource.set(resource, existing);
  }

  for (const [resource, resourceCalls] of byResource) {
    const totalConsumed = resourceCalls.reduce((s, c) => s + c.consumed, 0);
    const lastCall = resourceCalls.at(-1);
    const remaining = lastCall?.after.remaining ?? 0;
    const limit = lastCall?.after.limit ?? 0;
    const reset = lastCall?.after.reset ?? 0;

    lines.push(
      "",
      `  ${resource.toUpperCase()}:`,
      `    Calls: ${resourceCalls.length}`,
      `    Consumed: ${totalConsumed}`,
      `    Remaining: ${remaining}/${limit}`,
    );

    if (reset > 0) {
      const resetDate = new Date(reset * 1000);
      const minutesUntilReset = Math.max(
        0,
        Math.round((reset * 1000 - Date.now()) / 60_000),
      );
      lines.push(
        `    Resets: ${resetDate.toLocaleTimeString()} (${minutesUntilReset}m)`,
      );
    }

    // Show individual calls
    lines.push("    Breakdown:");
    for (const call of resourceCalls) {
      const cmd =
        call.command.length > 40
          ? call.command.slice(0, 37) + "..."
          : call.command;
      lines.push(`      ${cmd}: +${call.consumed}`);
    }
  }

  lines.push("", "─".repeat(60));

  return lines.join("\n");
}
