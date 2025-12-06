/**
 * Unified feedback fetching for PR status command.
 */

import type { PageInfo, PullRequestFeedback } from "./types.js";
import { graphqlQuery, graphqlPaginate } from "./github-graphql.js";
import {
  UNIFIED_FEEDBACK_QUERY,
  REVIEWS_PAGINATION_QUERY,
  COMMENTS_PAGINATION_QUERY,
  THREADS_PAGINATION_QUERY,
} from "./graphql-queries.js";
import {
  transformReviews,
  transformThreads,
  transformComments,
  type ReviewNode,
  type ReviewThreadNode,
  type TopLevelCommentNode,
} from "./transform-feedback.js";

type FetchOptions = {
  hideHidden?: boolean;
  hideResolved?: boolean;
};

export function fetchAllFeedback(
  owner: string,
  repo: string,
  prNumber: number,
  options: FetchOptions = {},
): PullRequestFeedback {
  const { hideHidden = false, hideResolved = false } = options;

  const result = graphqlQuery<{
    data: {
      repository: {
        pullRequest: {
          title: string;
          url: string;
          reviews: { pageInfo: PageInfo; nodes: ReviewNode[] };
          comments: { pageInfo: PageInfo; nodes: TopLevelCommentNode[] };
          reviewThreads: { pageInfo: PageInfo; nodes: ReviewThreadNode[] };
        };
      };
    };
  }>(UNIFIED_FEEDBACK_QUERY, { owner, repo, pr: prNumber });

  const pr = result.data.repository.pullRequest;

  let allReviews = pr.reviews.nodes;
  let allComments = pr.comments.nodes;
  let allThreads = pr.reviewThreads.nodes;

  // Paginate reviews
  if (pr.reviews.pageInfo.hasNextPage && pr.reviews.pageInfo.endCursor) {
    const rest = graphqlPaginate<ReviewNode>(
      REVIEWS_PAGINATION_QUERY,
      { owner, repo, pr: prNumber, cursor: pr.reviews.pageInfo.endCursor },
      (r) =>
        (
          r as {
            data: {
              repository: {
                pullRequest: {
                  reviews: { pageInfo: PageInfo; nodes: ReviewNode[] };
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
    const rest = graphqlPaginate<TopLevelCommentNode>(
      COMMENTS_PAGINATION_QUERY,
      { owner, repo, pr: prNumber, cursor: pr.comments.pageInfo.endCursor },
      (r) =>
        (
          r as {
            data: {
              repository: {
                pullRequest: {
                  comments: {
                    pageInfo: PageInfo;
                    nodes: TopLevelCommentNode[];
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
    const rest = graphqlPaginate<ReviewThreadNode>(
      THREADS_PAGINATION_QUERY,
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
                    nodes: ReviewThreadNode[];
                  };
                };
              };
            };
          }
        ).data.repository.pullRequest.reviewThreads,
    );
    allThreads = [...allThreads, ...rest];
  }

  const reviews = transformReviews(allReviews, hideHidden);
  const threads = transformThreads(allThreads, hideHidden, hideResolved);
  const comments = transformComments(allComments, hideHidden);

  reviews.sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  threads.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  return {
    number: prNumber,
    url: pr.url,
    title: pr.title,
    reviews,
    threads,
    comments,
  };
}
