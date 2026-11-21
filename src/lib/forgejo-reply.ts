/**
 * Posting replies to Forgejo feedback.
 *
 * Inline review comments thread natively: a reply POSTs into the parent's
 * review on the same line (reviews/{id}/comments) and nests under the original,
 * carrying an invisible parent-id marker (see forgejo-thread-reply) so the
 * summary re-attaches it to the exact comment it answered. Top-level PR comments,
 * review bodies, and inline comments with no diff position (the create endpoint
 * blames a line and rejects a zero position) have no line to thread under.
 */

import type { FeedbackItemRef, ReplyResult } from "./feedback-backend.js";
import type { ForgejoReviewComment } from "./forgejo-schemas.js";
import { forgejoFetch } from "./forgejo-http.js";
import { forgejoThreadReplyBody, hasThreadablePosition } from "./forgejo-thread-reply.js";

const FORGEJO_REPLY_MARKER = "> Replying to ";

const markerNouns = {
  thread: "review comment",
  comment: "comment",
  review: "review",
} as const satisfies Record<FeedbackItemRef["type"], string>;

type ReplyTarget = Pick<FeedbackItemRef, "type" | "id">;

function forgejoReplyPrefix(item: ReplyTarget): string {
  return `${FORGEJO_REPLY_MARKER}${markerNouns[item.type]} #${item.id}\n\n`;
}

interface MarkedReply {
  targetId: number;
  text: string;
}

// Forgejo issue and review comment IDs share one sequence, so the ID alone names the item.
function parseForgejoReplyMarker(body: string): MarkedReply | undefined {
  if (!body.startsWith(FORGEJO_REPLY_MARKER)) {
    return undefined;
  }
  const rest = body.slice(FORGEJO_REPLY_MARKER.length);
  for (const noun of Object.values(markerNouns)) {
    const match = new RegExp(`^${noun} #(?<id>\\d+)(?:\\r?\\n|$)`, "u").exec(rest);
    const id = match?.groups?.id;
    if (match !== null && id !== undefined) {
      return {
        targetId: Number(id),
        text: rest.slice(match[0].length).replace(/^(?:\r?\n)+/u, ""),
      };
    }
  }
  return undefined;
}

export function parseViewerIssueCommentReply(
  comment: { author: string | null | undefined; body: string },
  viewer: string,
): MarkedReply | undefined {
  return comment.author === viewer ? parseForgejoReplyMarker(comment.body) : undefined;
}

export function stripForgejoReplyMarker(body: string): string {
  return parseForgejoReplyMarker(body)?.text ?? body;
}

type ForgejoReplyRoute =
  | { kind: "thread"; reviewId: number; reviewComment: ForgejoReviewComment }
  | { kind: "issue-comment" };

export function forgejoReplyRoute(
  item: Pick<FeedbackItemRef, "type">,
  reviewComment: ForgejoReviewComment | undefined,
): ForgejoReplyRoute {
  const reviewId = reviewComment?.pull_request_review_id;
  if (
    item.type === "thread" &&
    reviewComment !== undefined &&
    typeof reviewId === "number" &&
    hasThreadablePosition(reviewComment)
  ) {
    return { kind: "thread", reviewId, reviewComment };
  }
  return { kind: "issue-comment" };
}

export async function postForgejoReply(
  slug: string,
  item: FeedbackItemRef,
  message: string,
  reviewComment: ForgejoReviewComment | undefined,
): Promise<ReplyResult> {
  const route = forgejoReplyRoute(item, reviewComment);
  let path: string;
  let body: Record<string, string | number>;
  if (route.kind === "thread") {
    path = `repos/${slug}/pulls/${item.prNumber}/reviews/${route.reviewId}/comments`;
    body = forgejoThreadReplyBody(route.reviewComment, message);
  } else {
    path = `repos/${slug}/issues/${item.prNumber}/comments`;
    body = { body: forgejoReplyPrefix(item) + message };
  }

  const reply = await forgejoFetch<{ id: number; html_url: string }>({
    method: "POST",
    path,
    body,
  });
  if (reply === undefined) {
    throw new Error(
      `Forgejo POST ${path}: missing JSON reply response; the reply may already exist`,
    );
  }
  return { id: reply.id, url: reply.html_url };
}
