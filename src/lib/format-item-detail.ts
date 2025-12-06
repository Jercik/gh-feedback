/**
 * Item detail formatters for read command output.
 */

import type { ItemDetail } from "./fetch-item-detail.js";

export function formatItemDetail(item: ItemDetail): string {
  const lines: string[] = [];

  switch (item.type) {
    case "review": {
      lines.push(
        `Review #${item.id}`,
        `State: ${item.state}`,
        `Author: @${item.author}`,
        `Submitted: ${item.submittedAt}`,
        `URL: ${item.url}`,
      );
      if (item.reactions.length > 0) {
        const reactionString = item.reactions
          .map((r) => `${r.content}: ${r.count}`)
          .join(", ");
        lines.push(`Reactions: ${reactionString}`);
      }
      lines.push("", "Body:", "---", item.body || "(no body)", "---");
      break;
    }
    case "thread": {
      lines.push(`Review comment thread #${item.id}`);
      if (item.path) {
        lines.push(
          `Location: ${item.path}${item.line === null ? "" : `:${item.line}`}`,
        );
      }
      lines.push(`Status: ${item.isResolved ? "resolved" : "unresolved"}`);
      if (item.isOutdated) {
        lines.push("Note: outdated (code has changed)");
      }
      lines.push(`Comments: ${item.comments.length}`, "");

      for (const [index, comment] of item.comments.entries()) {
        if (index === 0) {
          lines.push(`@${comment.author} (comment #${comment.id}):`);
        } else {
          lines.push(`Reply from @${comment.author} (#${comment.id}):`);
        }
        lines.push(`  Created: ${comment.createdAt}`);
        if (comment.reactions.length > 0) {
          const reactionString = comment.reactions
            .map((r) => `${r.content}: ${r.count}`)
            .join(", ");
          lines.push(`  Reactions: ${reactionString}`);
        }
        lines.push("");
        for (const line of comment.body.split("\n")) {
          lines.push(`  ${line}`);
        }
        lines.push("");
      }
      break;
    }
    case "comment": {
      lines.push(
        `Issue comment #${item.id}`,
        `Author: @${item.author}`,
        `Created: ${item.createdAt}`,
        `URL: ${item.url}`,
      );
      if (item.reactions.length > 0) {
        const reactionString = item.reactions
          .map((r) => `${r.content}: ${r.count}`)
          .join(", ");
        lines.push(`Reactions: ${reactionString}`);
      }
      lines.push("", "Body:", "---", item.body, "---");
      break;
    }
  }

  return lines.join("\n");
}
