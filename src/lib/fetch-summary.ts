/**
 * Fetch complete PR feedback with body content for LLM context.
 */

import type { PageInfo, PullRequestSummary } from "./types.js";
import { graphqlQuery, graphqlPaginate } from "./github-graphql.js";
import {
  SUMMARY_FEEDBACK_QUERY,
  SUMMARY_REVIEWS_PAGINATION_QUERY,
  SUMMARY_COMMENTS_PAGINATION_QUERY,
  SUMMARY_THREADS_PAGINATION_QUERY,
} from "./graphql-queries.js";
import {
  transformSummaryReviews,
  transformSummaryThreads,
  transformSummaryComments,
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
): PullRequestSummary {
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

  const reviews = transformSummaryReviews(allReviews, hideHidden);
  const threads = transformSummaryThreads(allThreads, hideHidden, hideResolved);
  const comments = transformSummaryComments(allComments, hideHidden);

  // Sort by date
  reviews.sort(
    (a, b) =>
      new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime(),
  );
  threads.sort(
    (a, b) =>
      new Date(a.comments[0]?.createdAt ?? 0).getTime() -
      new Date(b.comments[0]?.createdAt ?? 0).getTime(),
  );
  comments.sort(
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
