import { describe, expect, it } from "vitest";
import { mapCommentsToItems } from "./map-comments-to-items.js";
import type { CommentRecord, ReviewRecord } from "./feedback-types.js";

function review(fields: Partial<ReviewRecord>): ReviewRecord {
  return {
    id: 7,
    state: "COMMENT",
    unpublished: false,
    user: { id: null, login: "reviewer" },
    body: "Please split this change",
    submittedAt: null,
    commitId: null,
    htmlUrl: null,
    backingCommentId: 50,
    viewerReactions: [],
    status: "pending",
    conflictingFinalReactions: false,
    ...fields,
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

describe("mapCommentsToItems", () => {
  it("maps a review body and an inline finding to themselves", () => {
    expect([
      ...mapCommentsToItems([review({})], [inlineComment(60, "finding", null)]),
    ]).toStrictEqual([
      [50, 50],
      [60, 60],
    ]);
  });

  it.each([
    ["has no body", review({ body: " " })],
    ["is unpublished", review({ unpublished: true })],
    ["has no backing comment", review({ backingCommentId: null })],
  ])("leaves out a review that %s", (_reason, record) => {
    expect([...mapCommentsToItems([record], [])]).toStrictEqual([]);
  });

  it("maps a reply to a reply to the finding the first reply answers", () => {
    expect([
      ...mapCommentsToItems(
        [],
        [
          inlineComment(60, "finding", null),
          inlineComment(61, "reply", 60),
          inlineComment(62, "reply", 61),
        ],
      ),
    ]).toStrictEqual([
      [60, 60],
      [61, 60],
      [62, 60],
    ]);
  });

  it("leaves out a reply whose target is no comment of the pull request", () => {
    expect([...mapCommentsToItems([], [inlineComment(61, "reply", 60)])]).toStrictEqual([]);
  });
});
