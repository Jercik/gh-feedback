/* eslint-disable unicorn/no-null */
import { describe, it, expect } from "vitest";
import { formatAllFeedback } from "./format-feedback.js";
import type { PullRequestFeedback } from "./types.js";

describe("formatAllFeedback", () => {
  const baseFeedback: PullRequestFeedback = {
    number: 123,
    title: "Test PR",
    url: "https://github.com/test/test/pull/123",
    reviews: [],
    threads: [],
    comments: [],
  };

  it("formats reactions as ASCII labels", () => {
    const feedback: PullRequestFeedback = {
      ...baseFeedback,
      reviews: [
        {
          id: 1,
          state: "APPROVED",
          author: "reviewer",
          url: "https://github.com/test/test/pull/123#pullrequestreview-1",
          submittedAt: "2024-01-01T00:00:00Z",
          isMinimized: false,
          minimizedReason: null,
          viewerReactions: ["THUMBS_UP", "HEART"],
        },
      ],
    };

    const result = formatAllFeedback(feedback);
    expect(result).toContain("reacted: +1 heart");
  });

  it("converts unknown reactions to lowercase", () => {
    const feedback: PullRequestFeedback = {
      ...baseFeedback,
      threads: [
        {
          id: 1,
          path: "test.ts",
          line: 10,
          author: "commenter",
          createdAt: "2024-01-01T00:00:00Z",
          replyCount: 0,
          isResolved: false,
          isOutdated: false,
          viewerReactions: ["UNKNOWN_REACTION"],
        },
      ],
    };

    const result = formatAllFeedback(feedback);
    expect(result).toContain("reacted: unknown_reaction");
  });

  it("formats empty feedback correctly", () => {
    const result = formatAllFeedback(baseFeedback);
    expect(result).toContain("Pull Request #123: Test PR");
    expect(result).toContain("Reviews: none");
    expect(result).toContain("Threads: none");
    expect(result).toContain("Comments: none");
  });

  it("shows resolved status for threads", () => {
    const feedback: PullRequestFeedback = {
      ...baseFeedback,
      threads: [
        {
          id: 42,
          path: "src/index.ts",
          line: 5,
          author: "dev",
          createdAt: "2024-01-01T00:00:00Z",
          replyCount: 2,
          isResolved: true,
          isOutdated: false,
          viewerReactions: [],
        },
      ],
    };

    const result = formatAllFeedback(feedback);
    expect(result).toContain("[resolved]");
    expect(result).toContain("2 replies");
  });

  it("shows hidden status for minimized reviews", () => {
    const feedback: PullRequestFeedback = {
      ...baseFeedback,
      reviews: [
        {
          id: 99,
          state: "COMMENTED",
          author: "bot",
          url: "https://github.com/test/test/pull/123#pullrequestreview-99",
          submittedAt: "2024-01-01T00:00:00Z",
          isMinimized: true,
          minimizedReason: "RESOLVED",
          viewerReactions: [],
        },
      ],
    };

    const result = formatAllFeedback(feedback);
    expect(result).toContain("[hidden: RESOLVED]");
  });
});
