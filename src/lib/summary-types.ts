/**
 * Unified types for summary output.
 *
 * All feedback items (threads, comments, reviews) are normalized
 * to a single FeedbackItem type with semantic status.
 */

import type { DoneStatus, FindingStatus } from "./feedback-types.js";
import { doneStatuses } from "./feedback-types.js";

/**
 * A response/reply to a feedback item.
 */
export interface FeedbackResponse {
  readonly author: string;
  readonly timestamp: string;
  readonly body: string;
}

/**
 * Unified feedback item for summary output.
 * Combines threads, comments, and reviews into one type.
 */
export interface FeedbackItem {
  readonly id: number | null;
  readonly actionable?: boolean;
  readonly reviewId?: number;
  readonly timestamp: string;
  /**
   * The viewer's reaction status with resolution folded in: a resolved item without a final
   * reaction reads "in-progress". Such an item may be active work, work interrupted in a previous
   * session, or a resolution made outside this workflow; treat the last as new feedback.
   */
  readonly status: FindingStatus;
  readonly author: string;
  /** File path and line for code comments, empty for general comments */
  readonly location: string;
  readonly body: string;
  readonly responses: readonly FeedbackResponse[];
}

/**
 * Complete summary output.
 */
export interface FeedbackSummary {
  readonly prNumber: number;
  readonly prUrl: string;
  readonly prTitle: string;
  readonly items: readonly FeedbackItem[];
}

// A settled finding lets its inline conversation resolve; a disagreement leaves that call to the reviewer.
export const settledStatuses = [
  "agreed",
  "acknowledged",
  "dismissed",
] as const satisfies readonly DoneStatus[];

export function isStatusSettled(status: FindingStatus): status is (typeof settledStatuses)[number] {
  return settledStatuses.some((settled) => settled === status);
}

export function isStatusDone(status: FindingStatus): status is DoneStatus {
  return doneStatuses.some((done) => done === status);
}

/**
 * Truncate text in the middle if too long.
 * Preserves start and end for context.
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const ellipsis = " [TRUNCATED] ";
  const availableLength = maxLength - ellipsis.length;
  const startLength = Math.ceil(availableLength / 2);
  const endLength = Math.floor(availableLength / 2);

  return text.slice(0, startLength) + ellipsis + text.slice(-endLength);
}
