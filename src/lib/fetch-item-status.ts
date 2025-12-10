/**
 * Fetch the current workflow status of a feedback item.
 *
 * Used to enforce workflow rules (e.g., can't go from agreed → disagreed directly).
 */

import type { DetectedItem } from "./detect-item-type.js";
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

/**
 * Check if an item is in a "done" workflow status (agreed/disagreed/acknowledged).
 * Returns the current status if done, undefined otherwise.
 */
export function getItemDoneStatus(
  item: DetectedItem,
): "agreed" | "disagreed" | "acknowledged" | undefined {
  const result = graphqlQuery<QueryResult>(ITEM_REACTIONS_QUERY, {
    id: item.nodeId,
  });

  if (!result.data.node) {
    return undefined;
  }

  const reactions = result.data.node.reactionGroups;
  // isDone: threads use isResolved, comments/reviews use isMinimized
  const isDone = item.isResolved ?? result.data.node.isMinimized ?? false;

  const status = reactionToStatus(reactions, isDone);

  if (isStatusDone(status)) {
    return status as "agreed" | "disagreed" | "acknowledged";
  }

  return undefined;
}
