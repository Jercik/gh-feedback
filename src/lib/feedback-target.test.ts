import { describe, expect, it } from "vitest";
import { parseTargetOptions } from "./feedback-target.js";

describe("parseTargetOptions", () => {
  it.each([
    [
      { repo: "o/r", pr: "5" },
      { kind: "explicit", slug: "o/r", prNumber: 5 },
    ],
    [
      { repo: undefined, pr: "5" },
      { kind: "checkout", prNumber: 5 },
    ],
    [
      { repo: undefined, pr: undefined },
      { kind: "checkout", prNumber: undefined },
    ],
  ])("accepts %j", (options, expected) => {
    expect(parseTargetOptions(options)).toStrictEqual(expected);
  });

  it.each([
    [
      { repo: "o/r", pr: undefined },
      "--repo requires --pr: a branch's pull request is looked up only in origin's repository",
    ],
    [{ repo: undefined, pr: "0" }, "--pr must be a positive safe integer"],
    [{ repo: undefined, pr: "1.5" }, "--pr must be a positive safe integer"],
    [{ repo: undefined, pr: "9007199254740993" }, "--pr must be a positive safe integer"],
    [{ repo: "owner", pr: "5" }, "--repo must be owner/repo"],
    [{ repo: "a/b/c", pr: "5" }, "--repo must be owner/repo"],
  ])("rejects %j", (options, message) => {
    expect(() => parseTargetOptions(options)).toThrow(message);
  });
});
