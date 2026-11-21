import { expect, test } from "vitest";
import { collectItemReplies } from "./collect-item-replies.js";
import type { CommentRecord, IssueCommentRecord } from "./feedback-types.js";

function issueFields(id: number, login: string, body: string) {
  return {
    id,
    user: { id: null, login },
    body,
    createdAt: `2026-04-0${id % 10}T08:00:00Z`,
    updatedAt: null,
    htmlUrl: null,
  };
}

function issueFinding(id: number, body: string): IssueCommentRecord {
  return {
    ...issueFields(id, "reviewer", body),
    kind: "finding",
    replyTo: null,
    viewerReactions: [],
    status: "pending",
    conflictingFinalReactions: false,
  };
}

function issueReply(id: number, replyTo: number, body: string): IssueCommentRecord {
  return {
    ...issueFields(id, "author", body),
    kind: "reply",
    replyTo,
    viewerReactions: null,
    status: null,
    conflictingFinalReactions: false,
  };
}

function inlineComment(
  id: number,
  kind: CommentRecord["kind"],
  replyTo: number | null,
  body: string,
): CommentRecord {
  return {
    id,
    kind,
    replyTo,
    user: { id: null, login: "reviewer" },
    body,
    createdAt: null,
    path: "src/app.ts",
    position: 4,
    originalPosition: 4,
    extraLinesCount: 0,
    side: "new",
    displayLine: 4,
    pullRequestReviewId: 8,
    htmlUrl: null,
    resolver: null,
    viewerReactions: null,
    status: null,
    conflictingFinalReactions: false,
  };
}

function snapshot(records: IssueCommentRecord[], comments: CommentRecord[] = []) {
  return {
    reviews: { totalCount: 0, distinctCount: 0, countGap: 0, records: [] },
    conversations: [
      {
        reviewId: 8,
        path: "src/app.ts",
        side: "new" as const,
        displayLine: 4,
        anchorId: 30,
        resolver: null,
        comments,
      },
    ],
    issueComments: { totalCount: records.length, records },
  };
}

test("groups PR comment replies under the item their chain of replies answers", () => {
  expect([
    ...collectItemReplies(
      snapshot([
        issueFinding(21, "Please rename the flag"),
        issueReply(22, 21, "> Replying to comment #21\n\nRenamed to --dry-run\n\nSee abc123"),
        issueFinding(23, "Add a test"),
        issueReply(24, 22, "> Replying to comment #22\n\nAlso updated the help text"),
        issueReply(25, 23, "> Replying to comment #23\n\nAdded"),
      ]),
    ),
  ]).toStrictEqual([
    [
      21,
      {
        threadReplies: [],
        prCommentReplies: [
          {
            id: 22,
            author: "author",
            createdAt: "2026-04-02T08:00:00Z",
            body: "Renamed to --dry-run\n\nSee abc123",
          },
          {
            id: 24,
            author: "author",
            createdAt: "2026-04-04T08:00:00Z",
            body: "Also updated the help text",
          },
        ],
      },
    ],
    [
      23,
      {
        threadReplies: [],
        prCommentReplies: [
          { id: 25, author: "author", createdAt: "2026-04-05T08:00:00Z", body: "Added" },
        ],
      },
    ],
  ]);
});

test("groups a threaded reply and a PR comment reply that names it under the finding", () => {
  expect([
    ...collectItemReplies(
      snapshot(
        [issueReply(41, 31, "> Replying to review comment #31\n\nFixed in abc123")],
        [
          inlineComment(30, "finding", null, "This loop never ends"),
          inlineComment(31, "reply", 30, "<!-- gh-feedback:reply-to:30 -->\nWhich input?"),
        ],
      ),
    ),
  ]).toStrictEqual([
    [
      30,
      {
        threadReplies: [{ id: 31, author: "reviewer", createdAt: null, body: "Which input?" }],
        prCommentReplies: [
          { id: 41, author: "author", createdAt: "2026-04-01T08:00:00Z", body: "Fixed in abc123" },
        ],
      },
    ],
  ]);
});
