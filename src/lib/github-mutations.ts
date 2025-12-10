/**
 * GitHub GraphQL mutations for comment operations.
 */

import type { Classifier, ReactionContent } from "./types.js";
import { REACTION_TO_GRAPHQL } from "./constants.js";
import { graphqlQuery } from "./github-graphql.js";
import { exitWithMessage } from "./git-helpers.js";

export function minimizeComment(
  subjectId: string,
  classifier: Classifier,
): { isMinimized: boolean; minimizedReason: string | null } {
  try {
    const query = `mutation($subjectId: ID!, $classifier: ReportedContentClassifiers!) {
  minimizeComment(input: { subjectId: $subjectId, classifier: $classifier }) {
    minimizedComment {
      isMinimized
      minimizedReason
    }
  }
}`;

    const result = graphqlQuery<{
      data: {
        minimizeComment: {
          minimizedComment: {
            isMinimized: boolean;
            minimizedReason: string | null;
          };
        };
      };
    }>(query, { subjectId, classifier });

    return result.data.minimizeComment.minimizedComment;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("must have write access")) {
      exitWithMessage(
        "Error: You do not have permission to minimize this comment.",
      );
    }
    exitWithMessage(`Error minimizing comment: ${message}`);
  }
}

/**
 * Add a reaction to any Reactable entity via GraphQL.
 * Works for PullRequestReview, PullRequestReviewComment, and IssueComment.
 */
export function addReaction(
  subjectId: string,
  content: ReactionContent,
): { content: string } {
  try {
    const graphqlContent = REACTION_TO_GRAPHQL[content];
    const query = `mutation($subjectId: ID!, $content: ReactionContent!) {
  addReaction(input: { subjectId: $subjectId, content: $content }) {
    reaction {
      content
    }
  }
}`;

    const result = graphqlQuery<{
      data: {
        addReaction: {
          reaction: {
            content: string;
          };
        };
      };
    }>(query, { subjectId, content: graphqlContent });

    return result.data.addReaction.reaction;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    exitWithMessage(`Error adding reaction: ${message}`);
  }
}

/**
 * Remove a reaction from any Reactable entity via GraphQL.
 * Throws on error - caller can decide how to handle (e.g., ignore if not present).
 */
export function removeReaction(
  subjectId: string,
  content: ReactionContent,
): { content: string } {
  const graphqlContent = REACTION_TO_GRAPHQL[content];
  const query = `mutation($subjectId: ID!, $content: ReactionContent!) {
  removeReaction(input: { subjectId: $subjectId, content: $content }) {
    reaction {
      content
    }
  }
}`;

  const result = graphqlQuery<{
    data: {
      removeReaction: {
        reaction: {
          content: string;
        };
      };
    };
  }>(query, { subjectId, content: graphqlContent });

  return result.data.removeReaction.reaction;
}

export function resolveThread(threadId: string): { isResolved: boolean } {
  try {
    const query = `mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      isResolved
    }
  }
}`;

    const result = graphqlQuery<{
      data: {
        resolveReviewThread: {
          thread: {
            isResolved: boolean;
          };
        };
      };
    }>(query, { threadId });

    return result.data.resolveReviewThread.thread;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("must have write access")) {
      exitWithMessage(
        "Error: You do not have permission to resolve this thread.",
      );
    }
    exitWithMessage(`Error resolving thread: ${message}`);
  }
}
