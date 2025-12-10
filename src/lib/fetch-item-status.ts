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
        reactionGroups {
          content
          viewerHasReacted
        }
      }
      ... on IssueComment {
        reactionGroups {
          content
          viewerHasReacted
        }
      }
      ... on PullRequestReview {
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
  const isDone = item.isResolved ?? false;

  const status = reactionToStatus(reactions, isDone);

  if (isStatusDone(status)) {
    return status as "agreed" | "disagreed" | "acknowledged";
  }

  return undefined;
}
