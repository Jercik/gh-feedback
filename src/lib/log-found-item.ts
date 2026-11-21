import type { FeedbackItemRef } from "./feedback-backend.js";
import { formatCommentLocation } from "./format-comment-location.js";
import { verboseLog } from "./verbose-mode.js";

export function logFoundItem(item: FeedbackItemRef): void {
  verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
  if (item.path) {
    verboseLog(`Location: ${formatCommentLocation(item.path, item.line)}`);
  }
}
