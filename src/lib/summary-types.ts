/**
 * Unified types for summary output.
 *
 * All feedback items (threads, comments, reviews) are normalized
 * to a single FeedbackItem type with semantic status.
 */

/**
 * Semantic status derived from viewer's reactions AND resolution state.
 * Combines workflow state with done/not-done into a single field.
 */
type FeedbackStatus =
  | "pending" // No reaction, not resolved - needs attention
  | "in-progress" // Being worked on (or resolved without proper reaction)
  | "awaiting-reply" // 😕 confused, not resolved - blocked on reviewer
  | "agreed" // 👍 thumbs_up + resolved - fixed
  | "disagreed" // 👎 thumbs_down + resolved - won't fix
  | "acknowledged"; // 🚀 rocket + hidden - noted, no action

/**
 * A response/reply to a feedback item.
 */
export type FeedbackResponse = {
  readonly author: string;
  readonly timestamp: string;
  readonly body: string;
};

/**
 * Unified feedback item for summary output.
 * Combines threads, comments, and reviews into one type.
 */
export type FeedbackItem = {
  readonly id: number;
  readonly timestamp: string;
  readonly status: FeedbackStatus;
  readonly author: string;
  /** File path and line for code comments, empty for general comments */
  readonly location: string;
  readonly body: string;
  readonly responses: readonly FeedbackResponse[];
};

/**
 * Complete summary output.
 */
export type FeedbackSummary = {
  readonly prNumber: number;
  readonly prUrl: string;
  readonly prTitle: string;
  readonly items: readonly FeedbackItem[];
};

/**
 * Map GraphQL reaction content + resolution state to semantic status.
 *
 * Logic:
 * - If resolved/hidden: show final status (agreed, disagreed, acknowledged, resolved)
 * - If NOT resolved: show work status (pending, in-progress, awaiting-reply)
 *
 * This ensures status alone tells you if action is needed.
 */
export function reactionToStatus(
  reactions: ReadonlyArray<{ content: string; viewerHasReacted: boolean }>,
  isDone: boolean,
): FeedbackStatus {
  const viewerReactions = new Set(
    reactions.filter((r) => r.viewerHasReacted).map((r) => r.content),
  );

  if (isDone) {
    // Item is resolved/hidden - show final status if properly reacted
    if (viewerReactions.has("THUMBS_UP")) return "agreed";
    if (viewerReactions.has("THUMBS_DOWN")) return "disagreed";
    if (viewerReactions.has("ROCKET")) return "acknowledged";
    // Resolved without proper reaction - treat as in-progress so agent revisits
    return "in-progress";
  }

  // Item is NOT resolved/hidden - show work-in-progress status
  if (viewerReactions.has("CONFUSED")) return "awaiting-reply";
  if (viewerReactions.size > 0) return "in-progress";
  return "pending";
}

/**
 * Check if a status represents a "done" state.
 */
export function isStatusDone(status: FeedbackStatus): boolean {
  return (
    status === "agreed" || status === "disagreed" || status === "acknowledged"
  );
}

/**
 * Truncate text in the middle if too long.
 * Preserves start and end for context.
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const ellipsis = " [...] ";
  const availableLength = maxLength - ellipsis.length;
  const startLength = Math.ceil(availableLength / 2);
  const endLength = Math.floor(availableLength / 2);

  return text.slice(0, startLength) + ellipsis + text.slice(-endLength);
}

/**
 * Format location from path and line.
 */
export function formatLocation(
  path: string | null | undefined,
  line: number | null | undefined,
): string {
  if (!path) return "";
  return line ? `${path}:${line}` : path;
}
