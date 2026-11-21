import { describe, expect, it } from "vitest";
import { resolveIssueCommentReplies } from "./resolve-issue-comment-replies.js";
import type { CommentRecord, IssueCommentFields, ReviewRecord } from "./feedback-types.js";

function issueComment(id: number, login: string, body: string): IssueCommentFields {
  return { id, user: { id: null, login }, body, createdAt: null, updatedAt: null, htmlUrl: null };
}

function review(backingCommentId: number, body: string): ReviewRecord {
  return {
    id: 7,
    state: "COMMENT",
    unpublished: false,
    user: { id: null, login: "reviewer" },
    body,
    submittedAt: null,
    commitId: null,
    htmlUrl: null,
    backingCommentId,
    viewerReactions: [],
    status: "pending",
    conflictingFinalReactions: false,
  };
}

function inlineComment(
  id: number,
  kind: CommentRecord["kind"],
  replyTo: number | null,
): CommentRecord {
  return {
    id,
    kind,
    replyTo,
    user: { id: null, login: "reviewer" },
    body: "This file needs a license header",
    createdAt: null,
    path: "src/app.ts",
    position: 0,
    originalPosition: 0,
    extraLinesCount: 0,
    side: "zero",
    displayLine: 0,
    pullRequestReviewId: 8,
    htmlUrl: null,
    resolver: null,
    viewerReactions: null,
    status: null,
    conflictingFinalReactions: false,
  };
}

function replyTargets(
  issueComments: IssueCommentFields[],
  reviews: ReviewRecord[] = [],
  inlineComments: CommentRecord[] = [],
): [number, number][] {
  return [...resolveIssueCommentReplies({ reviews, inlineComments, issueComments }, "author")];
}

describe("resolveIssueCommentReplies", () => {
  it("attaches the viewer's reply to the PR comment it names", () => {
    expect(
      replyTargets([
        issueComment(101, "reviewer", "Please rename the flag"),
        issueComment(102, "author", "> Replying to comment #101\n\nRenamed in abc123"),
      ]),
    ).toStrictEqual([[102, 101]]);
  });

  it("leaves another account's reply a finding and attaches the viewer's reply to it", () => {
    expect(
      replyTargets([
        issueComment(101, "reviewer", "Please rename the flag"),
        issueComment(102, "maintainer", "> Replying to comment #101\n\nStill broken"),
        issueComment(103, "author", "> Replying to comment #102\n\nFixed in def456"),
      ]),
    ).toStrictEqual([[103, 102]]);
  });

  it("attaches a reply naming a comment with a later ID", () => {
    expect(
      replyTargets([
        issueComment(106, "author", "> Replying to comment #107\n\nSee the log"),
        issueComment(107, "reviewer", "The build fails on Windows"),
      ]),
    ).toStrictEqual([[106, 107]]);
  });

  it("attaches a reply to a reply", () => {
    expect(
      replyTargets([
        issueComment(111, "reviewer", "Flaky on retry"),
        issueComment(112, "author", "> Replying to comment #113\n\nWhich runner?"),
        issueComment(113, "author", "> Replying to comment #111\n\nSeen it twice"),
      ]),
    ).toStrictEqual([
      [113, 111],
      [112, 113],
    ]);
  });

  it("leaves one of two replies naming each other a finding", () => {
    expect(
      replyTargets([
        issueComment(108, "author", "> Replying to comment #109\n\nFirst"),
        issueComment(109, "author", "> Replying to comment #108\n\nSecond"),
      ]),
    ).toStrictEqual([[108, 109]]);
  });

  it("leaves a reply naming itself a finding", () => {
    expect(
      replyTargets([issueComment(110, "author", "> Replying to comment #110\n\nNote to self")]),
    ).toStrictEqual([]);
  });

  it("attaches a reply to the review body it names", () => {
    expect(
      replyTargets(
        [issueComment(203, "author", "> Replying to review #201\n\nCovered by the new test")],
        [review(201, "Summary: two findings")],
      ),
    ).toStrictEqual([[203, 201]]);
  });

  it("leaves a reply naming a review without a body a finding", () => {
    expect(
      replyTargets(
        [issueComment(203, "author", "> Replying to review #201\n\nCovered by the new test")],
        [review(201, "")],
      ),
    ).toStrictEqual([]);
  });

  it("attaches a reply to the inline finding it names, whatever kind its marker says", () => {
    expect(
      replyTargets(
        [
          issueComment(305, "author", "> Replying to review comment #301\n\nAdded"),
          issueComment(306, "author", "> Replying to comment #301\n\nAdded"),
        ],
        [],
        [inlineComment(301, "finding", null)],
      ),
    ).toStrictEqual([
      [305, 301],
      [306, 301],
    ]);
  });

  it("attaches a reply naming an inline reply that is attached to a finding", () => {
    expect(
      replyTargets(
        [issueComment(305, "author", "> Replying to review comment #302\n\nAdded")],
        [],
        [inlineComment(301, "finding", null), inlineComment(302, "reply", 301)],
      ),
    ).toStrictEqual([[305, 302]]);
  });

  it("leaves a reply naming an inline reply whose finding is gone a finding", () => {
    expect(
      replyTargets(
        [issueComment(305, "author", "> Replying to review comment #302\n\nAdded")],
        [],
        [inlineComment(302, "reply", 300)],
      ),
    ).toStrictEqual([]);
  });

  it("leaves a reply naming no comment in the pull request a finding", () => {
    expect(
      replyTargets([issueComment(104, "author", "> Replying to comment #999\n\nStill relevant?")]),
    ).toStrictEqual([]);
  });
});
