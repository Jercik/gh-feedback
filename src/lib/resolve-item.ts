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
  if (item.type === "thread") {
    if (!item.threadId) {
      throw new Error("Thread ID missing for thread item");
    }

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
 * - Comments/Reviews: unhidden (unminimized)
 */
export function unresolveItem(
  item: DetectedItem,
  isMinimized: boolean,
): UnresolveResult {
  if (item.type === "thread") {
    if (!item.threadId) {
      throw new Error("Thread ID missing for thread item");
    }

    if (!item.isResolved) {
      return { unresolved: true, method: "unresolved" };
    }

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
