import type { FeedbackItemRef } from "./feedback-backend.js";
import { verboseLog } from "./verbose-mode.js";

export function capitalize(word: string): string {
  return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
}

export function previewReply(
  item: FeedbackItemRef,
  command: { messageNoun: string; actions: string },
  message: string,
): void {
  verboseLog(`Found ${item.type} #${item.id} by @${item.author}`);
  if (item.path) {
    verboseLog(`Location: ${item.path}${item.line ? `:${item.line}` : ""}`);
  }
  verboseLog("");
  verboseLog(`${capitalize(command.messageNoun)}:`);
  verboseLog("---");
  verboseLog(message);
  verboseLog("---");
  verboseLog("");
  verboseLog(`Actions: ${command.actions}`);
}
