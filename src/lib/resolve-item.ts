/**
 * Resolve feedback items.
 *
 * - Threads: resolved natively via GitHub's resolve API
 * - Comments/Reviews: "resolved" means hidden (minimized)
 *
 * Both achieve the same goal: marking an item as "handled".
 */

import type { DetectedItem } from "./detect-item-type.js";
import {
  resolveThread,
  unresolveThread,
  minimizeComment,
  unminimizeComment,
} from "./github-mutations.js";

type ResolveResult = {
  resolved: boolean;
  method: "resolved" | "hidden";
};

export function resolveItem(item: DetectedItem): ResolveResult {
  // Threads (including reviews that target thread comments)
  if (item.threadId) {
    if (item.isResolved) {
      return { resolved: true, method: "resolved" };
    }

    const result = resolveThread(item.threadId);
    return { resolved: result.isResolved, method: "resolved" };
  }

  // Comments and reviews: hide them (minimize with RESOLVED reason)
  const result = minimizeComment(item.nodeId, "RESOLVED");
  return { resolved: result.isMinimized, method: "hidden" };
}

type UnresolveResult = {
  unresolved: boolean;
  method: "unresolved" | "unhidden";
};

/**
 * Unresolve/unhide a feedback item.
 *
 * - Threads: unresolved via GitHub's unresolve API
 * - Reviews with thread comments: unresolve the underlying thread
 * - Comments/Reviews: unhidden (unminimized)
 */
export function unresolveItem(
  item: DetectedItem,
  isMinimized: boolean,
): UnresolveResult {
  // Threads (including reviews that target thread comments)
  if (item.threadId && item.isResolved) {
    const result = unresolveThread(item.threadId);
    return { unresolved: !result.isResolved, method: "unresolved" };
  }

  // Comments and reviews: unhide them if minimized
  if (!isMinimized) {
    return { unresolved: true, method: "unhidden" };
  }

  const result = unminimizeComment(item.nodeId);
  return { unresolved: !result.isMinimized, method: "unhidden" };
}
