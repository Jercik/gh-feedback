import { describe, expect, it } from "vitest";
import {
  forgejoReplyRoute,
  parseViewerIssueCommentReply,
  stripForgejoReplyMarker,
} from "./forgejo-reply.js";
import { ForgejoReviewComment } from "./forgejo-schemas.js";

describe("forgejoReplyRoute", () => {
  it("threads a reply under a positioned comment of a known review", () => {
    const comment = ForgejoReviewComment.parse({ id: 5, position: 3, pull_request_review_id: 10 });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({
      kind: "thread",
      reviewId: 10,
      reviewComment: comment,
    });
  });

  it("posts an issue comment for a positioned comment without a review", () => {
    const comment = ForgejoReviewComment.parse({
      id: 5,
      position: 3,
      pull_request_review_id: null,
    });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({ kind: "issue-comment" });
  });

  it("posts an issue comment for a comment without a diff position", () => {
    const comment = ForgejoReviewComment.parse({ id: 5, position: 0, pull_request_review_id: 10 });
    expect(forgejoReplyRoute({ type: "thread" }, comment)).toStrictEqual({ kind: "issue-comment" });
  });
});

describe("parseViewerIssueCommentReply", () => {
  it.each([
    ["> Replying to review comment #5\n\nNot a defect", 5, "Not a defect"],
    ["> Replying to review #6\nThanks", 6, "Thanks"],
    ["> Replying to comment #7", 7, ""],
  ])("reads the item the viewer's reply names from %j", (body, targetId, text) => {
    expect(parseViewerIssueCommentReply({ author: "robin", body }, "robin")).toStrictEqual({
      targetId,
      text,
    });
  });

  it.each(["> Replying to the comment above\n\nAgreed", "Replying to comment #7"])(
    "reads no reply from %j",
    (body) => {
      expect(parseViewerIssueCommentReply({ author: "robin", body }, "robin")).toBeUndefined();
    },
  );

  it.each(["sam", null, undefined])("reads no reply from a comment written by %j", (author) => {
    expect(
      parseViewerIssueCommentReply({ author, body: "> Replying to comment #7\n\nDone" }, "robin"),
    ).toBeUndefined();
  });
});

describe("stripForgejoReplyMarker", () => {
  it("returns the text after the marker", () => {
    expect(stripForgejoReplyMarker("> Replying to review comment #5\n\nNot a defect")).toBe(
      "Not a defect",
    );
  });

  it("returns a body without a marker unchanged", () => {
    expect(stripForgejoReplyMarker("Replying to comment #7")).toBe("Replying to comment #7");
  });
});
