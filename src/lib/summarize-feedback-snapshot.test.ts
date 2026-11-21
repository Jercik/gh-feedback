import { describe, expect, it } from "vitest";
import { summarizeFeedbackSnapshot } from "./summarize-feedback-snapshot.js";
import type { CommentRecord, IssueCommentRecord, ReviewRecord } from "./feedback-types.js";

function issueFields(id: number, login: string, body: string) {
  return {
    id,
    user: { id: null, login },
    body,
    createdAt: `2026-03-0${id % 10}T10:00:00Z`,
    updatedAt: null,
    htmlUrl: null,
  };
}

function issueFinding(id: number, login: string, body: string): IssueCommentRecord {
  return {
    ...issueFields(id, login, body),
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
  it("lists a reply among the responses of the comment it answers", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueFinding(101, "reviewer", "Please rename the flag"),
        issueReply(102, 101, "> Replying to comment #101\n\nRenamed in abc123"),
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

  it("lists a marked comment that is a finding as an item with its marker", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueFinding(101, "reviewer", "Please rename the flag"),
        issueFinding(102, "maintainer", "> Replying to comment #101\n\nStill broken"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.body, item.responses])).toStrictEqual([
      [101, "Please rename the flag", []],
      [102, "> Replying to comment #101\n\nStill broken", []],
    ]);
  });

  it("lists a reply to the review body it answers", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot(
        [issueReply(203, 201, "> Replying to review #201\n\nCovered by the new test")],
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

  it("lists a reply to the inline comment it answers", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot(
        [issueReply(305, 301, "> Replying to review comment #301\n\nAdded")],
        [],
        [unpositionedFinding],
      ),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [301, [{ author: "author", timestamp: "2026-03-05T10:00:00Z", body: "Added" }]],
    ]);
  });

  it("lists a reply to a comment with a later ID", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueReply(106, 107, "> Replying to comment #107\n\nSee the log"),
        issueFinding(107, "reviewer", "The build fails on Windows"),
      ]),
      false,
    );
    expect(items.map((item) => [item.id, item.responses])).toStrictEqual([
      [107, [{ author: "author", timestamp: "2026-03-06T10:00:00Z", body: "See the log" }]],
    ]);
  });

  it("lists a reply to a reply under the item the first reply answers, oldest first", () => {
    const items = summarizeFeedbackSnapshot(
      snapshot([
        issueFinding(111, "reviewer", "Flaky on retry"),
        issueReply(112, 113, "> Replying to comment #113\n\nWhich runner?"),
        issueReply(113, 111, "> Replying to comment #111\n\nSeen it twice"),
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

  it.each([
    ["no comment in the snapshot", [issueReply(104, 999, "> Replying to comment #999\n\nLost")]],
    [
      "each other",
      [
        issueReply(108, 109, "> Replying to comment #109\n\nFirst"),
        issueReply(109, 108, "> Replying to comment #108\n\nSecond"),
      ],
    ],
  ])("rejects a snapshot whose replies answer %s", (_label, records) => {
    expect(() => summarizeFeedbackSnapshot(snapshot(records), false)).toThrow(
      /reaches no feedback item/u,
    );
  });
});
