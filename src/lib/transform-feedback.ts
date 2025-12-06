/**
 * Transform functions for feedback data.
 */

import type {
  ReactionGroupNode,
  ReviewMeta,
  ThreadMeta,
  CommentMeta,
  ReviewState,
} from "./types.js";
import { isIgnoredAuthor } from "./github-environment.js";

type ReviewNode = {
  databaseId: number;
  author: { login: string };
  state: ReviewState;
  body: string;
  url: string;
  submittedAt: string;
  isMinimized: boolean;
  minimizedReason: string | null;
  reactionGroups: Array<{ content: string; viewerHasReacted: boolean }>;
};

type ReviewCommentNode = {
  databaseId: number;
  author: { login: string };
  path: string | null;
  line: number | null;
  createdAt: string;
  isMinimized: boolean;
  reactionGroups: ReactionGroupNode[];
};

type ReviewThreadNode = {
  isResolved: boolean;
  isOutdated: boolean;
  comments: { nodes: ReviewCommentNode[] };
};

type TopLevelCommentNode = {
  databaseId: number;
  author: { login: string };
  url: string;
  createdAt: string;
  isMinimized: boolean;
  reactionGroups: ReactionGroupNode[];
};

export type { ReviewNode, ReviewThreadNode, TopLevelCommentNode };

function getViewerReactions(
  groups: ReadonlyArray<{ content: string; viewerHasReacted: boolean }>,
): string[] {
  return groups.filter((g) => g.viewerHasReacted).map((g) => g.content);
}

export function transformReviews(
  nodes: ReviewNode[],
  hideHidden: boolean,
): ReviewMeta[] {
  return nodes
    .filter((r) => !hideHidden || !r.isMinimized)
    .filter((r) => r.body && r.body.trim().length > 0)
    .filter((r) => !isIgnoredAuthor(r.author.login))
    .map((r) => ({
      id: r.databaseId,
      author: r.author.login,
      state: r.state,
      url: r.url,
      submittedAt: r.submittedAt,
      viewerReactions: getViewerReactions(r.reactionGroups),
      isMinimized: r.isMinimized,
      minimizedReason: r.minimizedReason,
    }));
}

export function transformThreads(
  nodes: ReviewThreadNode[],
  hideHidden: boolean,
  hideResolved: boolean,
): ThreadMeta[] {
  return nodes
    .filter((t) => !hideResolved || !t.isResolved)
    .flatMap((t) => {
      const visible = t.comments.nodes
        .filter((c) => !hideHidden || !c.isMinimized)
        .filter((c) => !isIgnoredAuthor(c.author.login));
      const first = visible[0];
      if (!first) return [];
      const viewerReactions = [
        ...new Set(
          visible.flatMap((c) => getViewerReactions(c.reactionGroups)),
        ),
      ];
      return [
        {
          id: first.databaseId,
          path: first.path,
          line: first.line,
          author: first.author.login,
          createdAt: first.createdAt,
          replyCount: visible.length - 1,
          viewerReactions,
          isOutdated: t.isOutdated,
          isResolved: t.isResolved,
        },
      ];
    });
}

export function transformComments(
  nodes: TopLevelCommentNode[],
  hideHidden: boolean,
): CommentMeta[] {
  return nodes
    .filter((c) => !hideHidden || !c.isMinimized)
    .filter((c) => !isIgnoredAuthor(c.author.login))
    .map((c) => ({
      id: c.databaseId,
      author: c.author.login,
      url: c.url,
      createdAt: c.createdAt,
      viewerReactions: getViewerReactions(c.reactionGroups),
      isMinimized: c.isMinimized,
    }));
}
