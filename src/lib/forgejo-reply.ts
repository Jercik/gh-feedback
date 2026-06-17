/**
 * Forgejo has no threaded-reply endpoint for review comments, so replies are
 * posted as PR issue comments prefixed with a marker that identifies them as
 * generated replies. The summary filters comments carrying this marker so a
 * user's own reply never reappears as fresh feedback.
 */

import type { FeedbackItemRef } from "./feedback-backend.js";

export const FORGEJO_REPLY_MARKER = "> Replying to ";

export function forgejoReplyPrefix(itemType: FeedbackItemRef["type"], itemId: number): string {
  if (itemType === "thread") {
    return `${FORGEJO_REPLY_MARKER}review comment #${itemId}\n\n`;
  }
  if (itemType === "comment") {
    return `${FORGEJO_REPLY_MARKER}comment #${itemId}\n\n`;
  }
  return `${FORGEJO_REPLY_MARKER}review #${itemId}\n\n`;
}
