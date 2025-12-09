/**
 * GraphQL query strings for GitHub API.
 */

export const UNIFIED_FEEDBACK_QUERY = `
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
            url
            submittedAt
            isMinimized
            minimizedReason
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
        comments(first: 50) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            url
            createdAt
            isMinimized
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
        reviewThreads(first: 50) {
          pageInfo { endCursor hasNextPage }
          nodes {
            isResolved
            isOutdated
            comments(first: 100) {
              nodes {
                databaseId
                author { login }
                path
                line
                createdAt
                isMinimized
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

export const REVIEWS_PAGINATION_QUERY = `
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
            url
            submittedAt
            isMinimized
            minimizedReason
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
    }
  }
`;

export const COMMENTS_PAGINATION_QUERY = `
  query($owner: String!, $repo: String!, $pr: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        comments(first: 50, after: $cursor) {
          pageInfo { endCursor hasNextPage }
          nodes {
            databaseId
            author { login }
            url
            createdAt
            isMinimized
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
    }
  }
`;

export const THREADS_PAGINATION_QUERY = `
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
                path
                line
                createdAt
                isMinimized
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

export const REVIEW_MINIMIZED_QUERY = `
  query($id: ID!) {
    node(id: $id) {
      ... on PullRequestReview {
        isMinimized
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
              }
            }
          }
        }
      }
    }
  }
`;
