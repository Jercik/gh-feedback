/* eslint-disable unicorn/no-null */
import { describe, it, expect } from "vitest";
import { formatCommentInfo, summarizeReactions } from "./format-comment.js";
import type { CommentInfo, IssueComment } from "./types.js";

describe("formatCommentInfo", () => {
  it("formats a basic comment correctly", () => {
    const comment: CommentInfo = {
      id: 123,
      pullRequestNumber: 1,
      path: null,
      line: null,
      body: "This is a test comment",
      author: "testuser",
      inReplyToId: null,
    };

    const result = formatCommentInfo(comment);
    expect(result).toContain("Comment #123 by @testuser");
    expect(result).toContain("> This is a test comment");
    expect(result).not.toContain("Location:");
    expect(result).not.toContain("Warning: This is already a reply");
  });

  it("formats a comment with location correctly", () => {
    const comment: CommentInfo = {
      id: 456,
      pullRequestNumber: 1,
      path: "src/test.ts",
      line: 10,
      body: "Comment on code",
      author: "dev",
      inReplyToId: null,
    };

    const result = formatCommentInfo(comment);
    expect(result).toContain("Location: src/test.ts:10");
  });

  it("formats a reply comment with warning", () => {
    const comment: CommentInfo = {
      id: 789,
      pullRequestNumber: 1,
      path: null,
      line: null,
      body: "Reply body",
      author: "replier",
      inReplyToId: 123,
    };

    const result = formatCommentInfo(comment);
    expect(result).toContain(
      "Warning: This is already a reply to comment #123",
    );
  });
});

describe("summarizeReactions", () => {
  it("summarizes reactions correctly", () => {
    const comment: IssueComment = {
      id: 1,
      node_id: "node1",
      body: "text",
      user: { login: "user" },
      issue_url: "url",
      html_url: "html_url",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      reactions: {
        total_count: 5,
        "+1": 2,
        "-1": 0,
        laugh: 0,
        confused: 0,
        heart: 3,
        hooray: 0,
        rocket: 0,
        eyes: 0,
      },
    };

    const result = summarizeReactions(comment);
    expect(result).toEqual([
      { content: "+1", count: 2 },
      { content: "heart", count: 3 },
    ]);
  });

  it("returns empty array when no reactions", () => {
    const comment: IssueComment = {
      id: 1,
      node_id: "node1",
      body: "text",
      user: { login: "user" },
      issue_url: "url",
      html_url: "html_url",
      created_at: "2023-01-01",
      updated_at: "2023-01-01",
      reactions: undefined,
    };
    const result = summarizeReactions(comment);
    expect(result).toEqual([]);
  });
});
