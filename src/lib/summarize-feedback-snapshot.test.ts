import { describe, expect, it } from "vitest";
import { summarizeFeedbackSnapshot } from "./summarize-feedback-snapshot.js";
import type { CommentRecord, IssueCommentRecord, ReviewRecord } from "./feedback-types.js";

function issueComment(id: number, login: string, body: string): IssueCommentRecord {
  return {
    id,
    user: { id: null, login },
    body,
    createdAt: `2026-03-0${id % 10}T10:00:00Z`,
    updatedAt: null,
    htmlUrl: null,
    viewerReactions: [],
    status: "pending",
    conflictingFinalReactions: false,
  };
}

function review(id: number, backingCommentId: number, body: string): ReviewRecord {
  return {
    id,
    state: "COMMENT",
    unpublished: false,
    user: { id: null, login: "reviewer" },
    body,
    submittedAt: "2026-03-01T09:00:00Z",
    commitId: null,
    htmlUrl: null,
    backingCommentId,
    viewerReactions: [],
    status: "pending",
    conflictingFinalReactions: false,
  };
}

const unpositionedFinding: CommentRecord = {
  id: 301,
  kind: "finding",
  replyTo: null,
  user: { id: null, login: "reviewer" },
  body: "This file needs a license header",
  createdAt: "2026-03-01T08:00:00Z",
  path: "src/app.ts",
  position: 0,
  originalPosition: 0,
  extraLinesCount: 0,
  side: "zero",
  displayLine: 0,
  pullRequestReviewId: 8,
  htmlUrl: null,
  resolver: null,
  viewerReactions: [],
  status: "pending",
  conflictingFinalReactions: false,
};

function snapshot(
  records: IssueCommentRecord[],
  reviews: ReviewRecord[] = [],
  comments: CommentRecord[] = [],
) {
  return {
    viewer: "author",
    reviews: {
      totalCount: reviews.length,
      distinctCount: reviews.length,
      countGap: 0,
      records: reviews,
    },
    conversations: comments.map((comment) => ({
      reviewId: comment.pullRequestReviewId,
      path: comment.path,
      side: comment.side,
      displayLine: comment.displayLine,
      anchorId: comment.id,
      resolver: null,
      comments: [comment],
    })),
    issueComments: { totalCount: records.length, records },
  };
}

describe("issue-comment replies", () => {
  it("attaches the viewer's reply to the comment it names", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(101, "reviewer", "Please rename the flag"),
        issueComment(102, "author", "> Replying to comment #101\n\nRenamed in abc123"),
      ]),
      false,
    );
    expect(items).toStrictEqual([
      {
        id: 101,
        timestamp: "2026-03-01T10:00:00Z",
        status: "pending",
        author: "reviewer",
        location: "",
        body: "Please rename the flag",
        responses: [
          { author: "author", timestamp: "2026-03-02T10:00:00Z", body: "Renamed in abc123" },
        ],
      },
    ]);
  });

  it("lists another account's reply as an item of its own", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(101, "reviewer", "Please rename the flag"),
        issueComment(102, "maintainer", "> Replying to comment #101\n\nStill broken"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [101, []],
      [102, []],
    ]);
  });

  it("attaches the viewer's reply to another account's reply", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(101, "reviewer", "Please rename the flag"),
        issueComment(102, "maintainer", "> Replying to comment #101\n\nStill broken"),
        issueComment(103, "author", "> Replying to comment #102\n\nFixed in def456"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [101, []],
      [102, [{ author: "author", timestamp: "2026-03-03T10:00:00Z", body: "Fixed in def456" }]],
    ]);
  });

  it("attaches a reply to the review body it names", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot(
        [issueComment(203, "author", "> Replying to review #201\n\nCovered by the new test")],
        [review(7, 201, "Summary: two findings")],
      ),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [
        201,
        [
          {
            author: "author",
            timestamp: "2026-03-03T10:00:00Z",
            body: "Covered by the new test",
          },
        ],
      ],
    ]);
  });

  it("attaches a reply to the inline comment it names", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot(
        [issueComment(305, "author", "> Replying to review comment #301\n\nAdded")],
        [],
        [unpositionedFinding],
      ),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [301, [{ author: "author", timestamp: "2026-03-05T10:00:00Z", body: "Added" }]],
    ]);
  });

  it("attaches a reply edited to name a later comment", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(106, "author", "> Replying to comment #107\n\nSee the log"),
        issueComment(107, "reviewer", "The build fails on Windows"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [107, [{ author: "author", timestamp: "2026-03-06T10:00:00Z", body: "See the log" }]],
    ]);
  });

  it("lists responses oldest first when a reply names a later reply", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(111, "reviewer", "Flaky on retry"),
        issueComment(112, "author", "> Replying to comment #113\n\nWhich runner?"),
        issueComment(113, "author", "> Replying to comment #111\n\nSeen it twice"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [
        111,
        [
          { author: "author", timestamp: "2026-03-02T10:00:00Z", body: "Which runner?" },
          { author: "author", timestamp: "2026-03-03T10:00:00Z", body: "Seen it twice" },
        ],
      ],
    ]);
  });

  it("lists one of two replies naming each other, with the other as its response", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueComment(108, "author", "> Replying to comment #109\n\nFirst"),
        issueComment(109, "author", "> Replying to comment #108\n\nSecond"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [109, [{ author: "author", timestamp: "2026-03-08T10:00:00Z", body: "First" }]],
    ]);
  });

  it("attaches a reply whose marker names the item by another kind", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot(
        [issueComment(306, "author", "> Replying to comment #301\n\nAdded")],
        [],
        [unpositionedFinding],
      ),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [301, [{ author: "author", timestamp: "2026-03-06T10:00:00Z", body: "Added" }]],
    ]);
  });

  it("keeps a reply that names no item in the pull request as an item", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([issueComment(104, "author", "> Replying to comment #999\n\nStill relevant?")]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([[104, []]]);
  });
});
