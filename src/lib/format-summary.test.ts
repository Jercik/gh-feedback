import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { formatSummary } from "./format-summary.js";
import type { FeedbackSummary } from "./summary-types.js";

const summary: FeedbackSummary = {
  prNumber: 7,
  prUrl: "https://code.j4k.dev/owner/repo/pulls/7",
  prTitle: "Feedback",
  items: [
    {
      id: null,
      actionable: false,
      reviewId: 12,
      timestamp: "",
      status: "pending",
      author: "reviewer",
      location: "",
      body: "Missing native anchor",
      responses: [],
    },
    {
      id: 13,
      timestamp: "2026-01-01",
      status: "pending",
      author: "reviewer",
      location: "",
      body: "Actionable finding",
      responses: [],
    },
  ],
};

describe("nonactionable review bodies", () => {
  it("retains missing anchors with an empty TSV ID", () => {
    expect(formatSummary(summary, { porcelain: true })).toBe(
      "ID\tTIMESTAMP\tSTATUS\tAUTHOR\tLOCATION\tBODY\tRESPONSES\n\t\tpending\treviewer\t\tMissing native anchor\t\n13\t2026-01-01\tpending\treviewer\t\tActionable finding\t",
    );
  });

  it("keeps the documented pending-ID pipeline actionable", () => {
    expect(
      execFileSync("/usr/bin/awk", ["-F", "\t", '$3 == "pending" && $1 != "" {print $1}'], {
        input: formatSummary(summary, { porcelain: true }),
        encoding: "utf8",
      }),
    ).toBe("13\n");
  });

  it("labels the review provenance without inventing an action target", () => {
    expect(formatSummary(summary, { porcelain: false })).toContain("nonactionable review #12");
    expect(formatSummary(summary, { porcelain: false })).not.toContain("#null");
    expect(formatSummary(summary, { porcelain: false })).toContain("Missing native anchor");
  });
});

describe("tsv response encoding", () => {
  it("escapes each complete response once and leaves only response boundaries unescaped", () => {
    expect(
      formatSummary(
        {
          prNumber: 7,
          prUrl: "url",
          prTitle: "Feedback",
          items: [
            {
              id: null,
              actionable: false,
              reviewId: 12,
              timestamp: "",
              status: "pending",
              author: "reviewer",
              location: "",
              body: "Finding",
              responses: [
                { author: "a|b", timestamp: "t\tz", body: "line\nnext\r\tpipe|slash\\" },
                { author: "second", timestamp: "later", body: "reply" },
              ],
            },
          ],
        },
        { porcelain: true },
      ),
    ).toBe(
      "ID\tTIMESTAMP\tSTATUS\tAUTHOR\tLOCATION\tBODY\tRESPONSES\n\t\tpending\treviewer\t\tFinding\t@a\\|b t\\tz: line\\nnext\\r\\tpipe\\|slash\\\\|@second later: reply",
    );
  });
});
