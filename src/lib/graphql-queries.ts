/**
 * GraphQL query strings for GitHub API.
 */

/**
 * Lightweight query for finding a thread by comment ID.
 *
 * Optimized for thread lookup - fetches minimal data:
 * - 100 threads per page (more than default since less data per thread)
 * - Only databaseId for comments (just enough to match)
 * - Only first comment per thread (thread starter has the ID we're looking for)
 *
 * Used by findThreadByCommentId() with early exit when found.
 */
export const THREAD_LOOKUP_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 100) {
              nodes { databaseId }
            }
          }
        }
      }
    }
  }
`;

/**
 * Full thread query with complete comment data.
 *
 * Used when we need full thread details (author, body, reactions).
 * More expensive than THREAD_LOOKUP_QUERY - use sparingly.
 */
export const THREAD_BY_COMMENT_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 50, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            id
            isResolved
            isOutdated
            path
            line
            comments(first: 100) {
              nodes {
                databaseId
                author { login }
                body
                path
                line
                createdAt
                reactionGroups {
                  content
                  users(first: 50) {
                    totalCount
                    nodes { login }
                  }
                  viewerHasReacted
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const REVIEW_REACTIONS_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on PullRequestReview {
        reactionGroups {
          content
          users(first: 100) {
            totalCount
            nodes { login }
          }
          viewerHasReacted
        }
      }
    }
  }
`;

// =============================================================================
// Summary Queries (include body content for LLM context)
// =============================================================================

export const SUMMARY_FEEDBACK_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        title
        url
        reviews(first: 50) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            state
            body
            submittedAt
            isMinimized
            reactionGroups {
              content
              viewerHasReacted
            }
          }
        }
        comments(first: 50) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            body
            createdAt
            isMinimized
            reactionGroups {
              content
              viewerHasReacted
            }
          }
        }
        reviewThreads(first: 50) {
          pageInfo { endCursor hasNextPage }
          nodes {
            isResolved
            isOutdated
            comments(first: 100) {
              nodes {
                databaseId
                author { login }
                body
                path
                line
                createdAt
                isMinimized
                reactionGroups {
                  content
                  viewerHasReacted
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const SUMMARY_REVIEWS_PAGINATION_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviews(first: 50, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            state
            body
            submittedAt
            isMinimized
            reactionGroups {
              content
              viewerHasReacted
            }
          }
        }
      }
    }
  }
`;

export const SUMMARY_COMMENTS_PAGINATION_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        comments(first: 50, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            body
            createdAt
            isMinimized
            reactionGroups {
              content
              viewerHasReacted
            }
          }
        }
      }
    }
  }
`;

export const SUMMARY_THREADS_PAGINATION_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 50, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            isResolved
            isOutdated
            comments(first: 100) {
              nodes {
                databaseId
                author { login }
                body
                path
                line
                createdAt
                isMinimized
                reactionGroups {
                  content
                  viewerHasReacted
                }
              }
            }
          }
        }
      }
    }
  }
`;
