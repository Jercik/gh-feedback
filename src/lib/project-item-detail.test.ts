import { expect, test } from "vitest";
import { projectItemDetail } from "./project-item-detail.js";
import type {
  ClassifiedIssueComment,
  CommentRecord,
  ReviewRecord,
  SweptComments,
  UserRef,
} from "./feedback-types.js";

const review: ReviewRecord = {
  id: 7,
  state: "REQUEST_CHANGES",
  unpublished: false,
  user: { id: null, login: "reviewer" },
  body: "Please split this change",
  submittedAt: "2026-05-01T09:00:00Z",
  commitId: null,
  htmlUrl: "https://forge.example/owner/repo/pulls/7#issuecomment-50",
  backingCommentId: 50,
  viewerReactions: null,
  status: null,
  conflictingFinalReactions: false,
};

function inlineComment(
  id: number,
  login: string,
  replyTo: number | null,
  body: string,
): CommentRecord {
  return {
    id,
    kind: replyTo === null ? "finding" : "reply",
    replyTo,
    user: { id: null, login },
    body,
    createdAt: `2026-05-01T10:0${id % 10}:00Z`,
    path: "src/app.ts",
    position: 12,
    originalPosition: 0,
    extraLinesCount: 2,
    side: "new",
    displayLine: 14,
    pullRequestReviewId: 7,
    htmlUrl: null,
    resolver: null,
    viewerReactions: null,
    status: null,
    conflictingFinalReactions: false,
  };
}

function issueComment(
  id: number,
  login: string,
  replyTo: number | null,
  body: string,
): ClassifiedIssueComment {
  const fields = {
    id,
    user: { id: null, login },
    body,
    createdAt: `2026-05-02T10:0${id % 10}:00Z`,
    updatedAt: null,
    htmlUrl: `https://forge.example/owner/repo/pulls/7#issuecomment-${id}`,
  };
  return replyTo === null
    ? { ...fields, kind: "finding", replyTo }
    : { ...fields, kind: "reply", replyTo };
}

function swept(resolver: UserRef | null = null): SweptComments {
  return {
    reviews: { totalCount: 1, distinctCount: 1, countGap: 0, records: [review] },
    conversations: [
      {
        reviewId: 7,
        path: "src/app.ts",
        side: "new",
        displayLine: 14,
        anchorId: 60,
        resolver,
        comments: [
          inlineComment(60, "reviewer", null, "This loop never ends"),
          inlineComment(61, "author", 60, "<!-- gh-feedback:reply-to:60 -->\nWhich input?"),
          inlineComment(62, "reviewer", null, "Name the constant"),
        ],
      },
    ],
    issueComments: {
      totalCount: 4,
      records: [
        issueComment(70, "reviewer", null, "Add a changelog line"),
        issueComment(71, "author", 70, "> Replying to comment #70\n\nThe project keeps none"),
        issueComment(72, "author", 61, "> Replying to review comment #61\n\nFixed in abc123"),
        issueComment(73, "author", 50, "> Replying to review #50\n\nSplit in two"),
      ],
    },
    unpublishedInlineComments: [],
  };
}

test("shows the thread of the finding an inline reply answers, with every reply to it", () => {
  expect(projectItemDetail(swept({ id: null, login: "reviewer" }), 61)).toStrictEqual({
    type: "thread",
    id: 60,
    path: "src/app.ts",
    line: 14,
    isOutdated: false,
    isResolved: true,
    comments: [
      {
        id: 60,
        author: "reviewer",
        body: "This loop never ends",
        createdAt: "2026-05-01T10:00:00Z",
      },
      { id: 61, author: "author", body: "Which input?", createdAt: "2026-05-01T10:01:00Z" },
    ],
    prCommentReplies: [
      { id: 72, author: "author", createdAt: "2026-05-02T10:02:00Z", body: "Fixed in abc123" },
    ],
  });
});

test("shows a finding that shares a conversation as a thread of its own", () => {
  expect(projectItemDetail(swept(), 62)).toStrictEqual({
    type: "thread",
    id: 62,
    path: "src/app.ts",
    line: 14,
    isOutdated: false,
    isResolved: false,
    comments: [
      { id: 62, author: "reviewer", body: "Name the constant", createdAt: "2026-05-01T10:02:00Z" },
    ],
    prCommentReplies: [],
  });
});

test("shows a PR comment with the replies to it", () => {
  expect(projectItemDetail(swept(), 70)).toStrictEqual({
    type: "comment",
    id: 70,
    author: "reviewer",
    url: "https://forge.example/owner/repo/pulls/7#issuecomment-70",
    createdAt: "2026-05-02T10:00:00Z",
    body: "Add a changelog line",
    prCommentReplies: [
      {
        id: 71,
        author: "author",
        createdAt: "2026-05-02T10:01:00Z",
        body: "The project keeps none",
      },
    ],
  });
});

test("shows a review body under its backing comment ID with the replies to it", () => {
  expect(projectItemDetail(swept(), 50)).toStrictEqual({
    type: "review",
    id: 50,
    author: "reviewer",
    state: "REQUEST_CHANGES",
    url: "https://forge.example/owner/repo/pulls/7#issuecomment-50",
    submittedAt: "2026-05-01T09:00:00Z",
    body: "Please split this change",
    prCommentReplies: [
      { id: 73, author: "author", createdAt: "2026-05-02T10:03:00Z", body: "Split in two" },
    ],
  });
});

test("finds no item for an ID that names no comment of the pull request", () => {
  expect(projectItemDetail(swept(), 7)).toBeUndefined();
});
