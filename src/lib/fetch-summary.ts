/**
 * Fetch complete PR feedback for summary output.
 */

import type { PageInfo } from "./types.js";
import type { FeedbackSummary, FeedbackItem } from "./summary-types.js";
import { graphqlQuery, graphqlPaginate } from "./github-graphql.js";
import {
  SUMMARY_FEEDBACK_QUERY,
  SUMMARY_REVIEWS_PAGINATION_QUERY,
  SUMMARY_COMMENTS_PAGINATION_QUERY,
  SUMMARY_THREADS_PAGINATION_QUERY,
} from "./graphql-queries.js";
import {
  transformReviews,
  transformComments,
  transformThreads,
  type SummaryReviewNode,
  type SummaryCommentNode,
  type SummaryThreadNode,
} from "./transform-summary.js";

type FetchOptions = {
  hideHidden?: boolean;
  hideResolved?: boolean;
};

export function fetchSummary(
  owner: string,
  repo: string,
  prNumber: number,
  options: FetchOptions = {},
): FeedbackSummary {
  const { hideHidden = false, hideResolved = false } = options;

  const result = graphqlQuery<{
    data: {
      repository: {
        pullRequest: {
          title: string;
          url: string;
          reviews: { pageInfo: PageInfo; nodes: SummaryReviewNode[] };
          comments: { pageInfo: PageInfo; nodes: SummaryCommentNode[] };
          reviewThreads: { pageInfo: PageInfo; nodes: SummaryThreadNode[] };
        };
      };
    };
  }>(SUMMARY_FEEDBACK_QUERY, { owner, repo, pr: prNumber });

  const pr = result.data.repository.pullRequest;

  let allReviews = pr.reviews.nodes;
  let allComments = pr.comments.nodes;
  let allThreads = pr.reviewThreads.nodes;

  // Paginate reviews
  if (pr.reviews.pageInfo.hasNextPage && pr.reviews.pageInfo.endCursor) {
    const rest = graphqlPaginate<SummaryReviewNode>(
      SUMMARY_REVIEWS_PAGINATION_QUERY,
      { owner, repo, pr: prNumber, cursor: pr.reviews.pageInfo.endCursor },
      (r) =>
        (
          r as {
            data: {
              repository: {
                pullRequest: {
                  reviews: { pageInfo: PageInfo; nodes: SummaryReviewNode[] };
                };
              };
            };
          }
        ).data.repository.pullRequest.reviews,
    );
    allReviews = [...allReviews, ...rest];
  }

  // Paginate comments
  if (pr.comments.pageInfo.hasNextPage && pr.comments.pageInfo.endCursor) {
    const rest = graphqlPaginate<SummaryCommentNode>(
      SUMMARY_COMMENTS_PAGINATION_QUERY,
      { owner, repo, pr: prNumber, cursor: pr.comments.pageInfo.endCursor },
      (r) =>
        (
          r as {
            data: {
              repository: {
                pullRequest: {
                  comments: {
                    pageInfo: PageInfo;
                    nodes: SummaryCommentNode[];
                  };
                };
              };
            };
          }
        ).data.repository.pullRequest.comments,
    );
    allComments = [...allComments, ...rest];
  }

  // Paginate threads
  if (
    pr.reviewThreads.pageInfo.hasNextPage &&
    pr.reviewThreads.pageInfo.endCursor
  ) {
    const rest = graphqlPaginate<SummaryThreadNode>(
      SUMMARY_THREADS_PAGINATION_QUERY,
      {
        owner,
        repo,
        pr: prNumber,
        cursor: pr.reviewThreads.pageInfo.endCursor,
      },
      (r) =>
        (
          r as {
            data: {
              repository: {
                pullRequest: {
                  reviewThreads: {
                    pageInfo: PageInfo;
                    nodes: SummaryThreadNode[];
                  };
                };
              };
            };
          }
        ).data.repository.pullRequest.reviewThreads,
    );
    allThreads = [...allThreads, ...rest];
  }

  // Transform to unified FeedbackItem format
  const reviewItems = transformReviews(allReviews, hideHidden);
  const threadItems = transformThreads(allThreads, hideHidden, hideResolved);
  const commentItems = transformComments(allComments, hideHidden);

  // Combine all items and sort by timestamp
  const allItems: FeedbackItem[] = [
    ...reviewItems,
    ...threadItems,
    ...commentItems,
  ];
  // Sort in place (allItems is already a new array from spread)
  allItems.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const items = allItems;

  return {
    prNumber,
    prUrl: pr.url,
    prTitle: pr.title,
    items,
  };
}
