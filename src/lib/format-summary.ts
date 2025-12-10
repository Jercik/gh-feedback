/**
 * Format feedback summary for output.
 *
 * Two modes:
 * - TSV: Tab-separated values for scripting/piping
 * - Pretty: Human-readable for interactive use
 */

import type {
  FeedbackSummary,
  FeedbackItem,
  FeedbackResponse,
} from "./summary-types.js";
import { truncateMiddle, isStatusDone } from "./summary-types.js";

const MAX_BODY_LENGTH = 500;
const RESPONSE_SEPARATOR = "|";

/**
 * Escape special characters for TSV output.
 * Newlines → \n, tabs → \t
 */
function escapeTsv(text: string): string {
  return text
    .replaceAll("\\", "\\\\")
    .replaceAll("\t", String.raw`\t`)
    .replaceAll("\n", String.raw`\n`)
    .replaceAll("\r", String.raw`\r`);
}

/**
 * Format responses for TSV output.
 * Each response: @author timestamp: body
 * Separated by |
 */
function formatResponsesTsv(responses: readonly FeedbackResponse[]): string {
  if (responses.length === 0) return "";

  return responses
    .map((r) => {
      const body = truncateMiddle(r.body, MAX_BODY_LENGTH);
      return `@${r.author} ${r.timestamp}: ${body}`;
    })
    .join(RESPONSE_SEPARATOR);
}

/**
 * Format summary as TSV (tab-separated values).
 * One line per item, header row included.
 */
function formatSummaryTsv(summary: FeedbackSummary): string {
  // Header row
  const header = [
    "ID",
    "TIMESTAMP",
    "STATUS",
    "AUTHOR",
    "LOCATION",
    "BODY",
    "RESPONSES",
  ].join("\t");

  // Data rows
  const rows = summary.items.map((item) => {
    const body = truncateMiddle(item.body, MAX_BODY_LENGTH);
    const responses = formatResponsesTsv(item.responses);

    return [
      String(item.id),
      item.timestamp,
      item.status,
      item.author,
      item.location,
      escapeTsv(body),
      escapeTsv(responses),
    ].join("\t");
  });

  return [header, ...rows].join("\n");
}

/**
 * Format responses for pretty output.
 */
function formatResponsesPretty(
  responses: readonly FeedbackResponse[],
): string[] {
  const lines: string[] = [];
  for (const r of responses) {
    lines.push(`  > @${r.author} ${r.timestamp}:`);
    for (const bodyLine of r.body.split("\n")) {
      lines.push(`    ${bodyLine}`);
    }
  }
  return lines;
}

/**
 * Format a single item for pretty output.
 */
function formatItemPretty(item: FeedbackItem): string[] {
  const lines: string[] = [];

  // Item header
  const location = item.location ? `  ${item.location}` : "";
  lines.push(
    `#${item.id}  ${item.timestamp}  ${item.status}  @${item.author}${location}`,
  );

  // Body (indented)
  const body = truncateMiddle(item.body, MAX_BODY_LENGTH);
  for (const bodyLine of body.split("\n")) {
    lines.push(`  ${bodyLine}`);
  }

  // Responses
  if (item.responses.length > 0) {
    lines.push(...formatResponsesPretty(item.responses));
  }

  return lines;
}

/**
 * Format summary as pretty human-readable output.
 */
function formatSummaryPretty(summary: FeedbackSummary): string {
  // Split into pending and done based on status
  const pending = summary.items.filter((item) => !isStatusDone(item.status));
  const done = summary.items.filter((item) => isStatusDone(item.status));

  // Build output
  const lines: string[] = [
    `PR #${summary.prNumber}: ${summary.prTitle}`,
    summary.prUrl,
    "",
    `PENDING (${pending.length})`,
    "",
  ];

  if (pending.length === 0) {
    lines.push("  (none)", "");
  } else {
    for (const item of pending) {
      lines.push(...formatItemPretty(item), "");
    }
  }

  lines.push(`DONE (${done.length})`, "");

  if (done.length === 0) {
    lines.push("  (none)");
  } else {
    for (const item of done) {
      lines.push(...formatItemPretty(item), "");
    }
  }

  return lines.join("\n");
}

/**
 * Format summary - auto-select format based on options.
 */
export function formatSummary(
  summary: FeedbackSummary,
  options: { porcelain?: boolean } = {},
): string {
  if (options.porcelain) {
    return formatSummaryTsv(summary);
  }
  return formatSummaryPretty(summary);
}
