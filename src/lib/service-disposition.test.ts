import { describe, expect, it } from "vitest";
import {
  assertCurrentDisposition,
  assertStoredDisposition,
  buildDispositionKey,
  isDispositionRecorded,
  parseDispositionRationale,
} from "./service-disposition.js";

describe("buildDispositionKey", () => {
  it("keeps the production key format", () => {
    expect(buildDispositionKey("code.j4k.dev", "owner/repo", 7, 501)).toBe(
      "forgejo:code.j4k.dev:owner/repo:7:outcome:501",
    );
  });
});

describe("isDispositionRecorded", () => {
  it.each([
    [{ kind: "dismissed", rationale: "Why" }, "dismissed", "Why", true],
    [{ kind: "dismissed", rationale: "Other" }, "dismissed", "Why", false],
    [{ kind: "reopened", rationale: "Why" }, "dismissed", "Why", false],
    [null, "dismissed", "Why", false],
  ] as const)("%j for %s %s is %s", (current, kind, rationale, expected) => {
    expect(isDispositionRecorded(current, kind, rationale)).toBe(expected);
  });
});

describe("parseDispositionRationale", () => {
  it("accepts text up to the limit", () => {
    expect(parseDispositionRationale("a".repeat(16_384))).toHaveLength(16_384);
  });

  it.each([
    ["", "empty"],
    ["a".repeat(16_385), "too long"],
    ["a\0b", "NUL"],
  ])("rejects %#: %s", (message) => {
    expect(() => parseDispositionRationale(message)).toThrow("1-16384 characters");
  });
});

describe("stored disposition checks", () => {
  const stored = { id: "D1", claimId: "C1", kind: "dismissed", rationale: "Why" } as const;

  it("accepts the disposition that was sent", () => {
    expect(() => {
      assertStoredDisposition(stored, { claimId: "C1", kind: "dismissed", rationale: "Why" });
    }).not.toThrow();
  });

  it("rejects a different stored rationale", () => {
    expect(() => {
      assertStoredDisposition(stored, { claimId: "C1", kind: "dismissed", rationale: "Else" });
    }).toThrow("different disposition");
  });

  it("rejects a superseded disposition", () => {
    expect(() => {
      assertCurrentDisposition("D2", "D1");
    }).toThrow("superseded");
    expect(() => {
      assertCurrentDisposition(undefined, "D1");
    }).toThrow("superseded");
    expect(() => {
      assertCurrentDisposition("D1", "D1");
    }).not.toThrow();
  });
});
