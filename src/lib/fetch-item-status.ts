/**
 * Fetch the current workflow status of a feedback item.
 *
 * Used to enforce workflow rules (e.g., can't go from agreed → disagreed directly).
 */

import type { DetectedItem } from "./detect-item-type.js";
import type { ReactionContent } from "./types.js";
import { GRAPHQL_TO_REACTION } from "./constants.js";
import { graphqlQuery } from "./github-graphql.js";
import { reactionToStatus, isStatusDone } from "./summary-types.js";

const ITEM_REACTIONS_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on PullRequestReviewComment {
        isMinimized
        reactionGroups {
          content
          viewerHasReacted
        }
      }
      ... on IssueComment {
        isMinimized
        reactionGroups {
          content
          viewerHasReacted
        }
      }
      ... on PullRequestReview {
        isMinimized
        reactionGroups {
          content
          viewerHasReacted
        }
      }
    }
  }
`;

type ReactionGroup = {
  content: string;
  viewerHasReacted: boolean;
};

type QueryResult = {
  data: {
    node: {
      isMinimized?: boolean;
      reactionGroups: ReactionGroup[];
    } | null;
  };
};

type ItemStatusResult = {
  doneStatus: "agreed" | "disagreed" | "acknowledged" | undefined;
  viewerReactions: ReactionContent[];
};

/**
 * Fetch item workflow status and viewer's current reactions.
 *
 * Returns:
 * - doneStatus: The current done status if item is done, undefined otherwise
 * - viewerReactions: List of reactions the viewer has added to this item
 */
export function getItemStatus(item: DetectedItem): ItemStatusResult {
  const result = graphqlQuery<QueryResult>(ITEM_REACTIONS_QUERY, {
    id: item.nodeId,
  });

  if (!result.data.node) {
    return { doneStatus: undefined, viewerReactions: [] };
  }

  const reactions = result.data.node.reactionGroups;
  // isDone: threads use isResolved, comments/reviews use isMinimized
  const isDone = item.isResolved ?? result.data.node.isMinimized ?? false;

  const status = reactionToStatus(reactions, isDone);

  const viewerReactions = reactions
    .filter((r) => r.viewerHasReacted)
    .map((r) => GRAPHQL_TO_REACTION[r.content])
    .filter((r): r is ReactionContent => r !== undefined);

  const doneStatus = isStatusDone(status)
    ? (status as "agreed" | "disagreed" | "acknowledged")
    : undefined;

  return { doneStatus, viewerReactions };
}
