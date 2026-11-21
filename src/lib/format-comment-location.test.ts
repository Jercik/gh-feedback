import { describe, expect, it } from "vitest";
import { formatCommentLocation } from "./format-comment-location.js";

describe("formatCommentLocation", () => {
  it.each([
    ["the path and line of a comment on a line", "src/app.ts", 9, "src/app.ts:9"],
    ["the path alone for a comment with no line", "src/app.ts", null, "src/app.ts"],
    ["nothing for a comment with no path", "", 9, ""],
  ])("gives %s", (_label, path, line, location) => {
    expect(formatCommentLocation(path, line)).toBe(location);
  });
});
