import { expect, test } from "vitest";
import { formatItemDetail } from "./format-item-detail.js";

test("prints each PR comment reply in full after the item", () => {
  expect(
    formatItemDetail({
      type: "comment",
      id: 21,
      author: "reviewer",
      url: "https://forge.example/owner/repo/pulls/7#issuecomment-21",
      createdAt: "2026-04-01T08:00:00Z",
      body: "Please rename the flag",
      reactions: [],
      prCommentReplies: [
        {
          id: 22,
          author: "author",
          createdAt: "2026-04-02T08:00:00Z",
          body: "Renamed to --dry-run\n\nSee abc123",
        },
        { id: 24, author: "author", createdAt: null, body: "Also updated the help text" },
      ],
    }),
  ).toBe(
    [
      "Issue comment #21",
      "Author: @reviewer",
      "Created: 2026-04-01T08:00:00Z",
      "URL: https://forge.example/owner/repo/pulls/7#issuecomment-21",
      "",
      "Body:",
      "---",
      "Please rename the flag",
      "---",
      "",
      "PR comment reply from @author (#22):",
      "  Created: 2026-04-02T08:00:00Z",
      "",
      "  Renamed to --dry-run",
      "  ",
      "  See abc123",
      "",
      "PR comment reply from @author (#24):",
      "",
      "  Also updated the help text",
    ].join("\n"),
  );
});

test("prints a thread's PR comment replies after its threaded replies", () => {
  expect(
    formatItemDetail({
      type: "thread",
      id: 30,
      path: "src/app.ts",
      line: 4,
      isOutdated: false,
      isResolved: false,
      comments: [
        {
          id: 30,
          author: "reviewer",
          body: "This loop never ends",
          createdAt: "2026-04-01T08:00:00Z",
          reactions: [],
        },
        {
          id: 31,
          author: "author",
          body: "Which input?",
          createdAt: "2026-04-01T09:00:00Z",
          reactions: [],
        },
      ],
      prCommentReplies: [
        { id: 41, author: "author", createdAt: "2026-04-02T08:00:00Z", body: "Fixed in abc123" },
      ],
    }),
  ).toBe(
    [
      "Review comment thread #30",
      "Location: src/app.ts:4",
      "Status: unresolved",
      "Comments: 2",
      "",
      "@reviewer (comment #30):",
      "  Created: 2026-04-01T08:00:00Z",
      "",
      "  This loop never ends",
      "",
      "Reply from @author (#31):",
      "  Created: 2026-04-01T09:00:00Z",
      "",
      "  Which input?",
      "",
      "PR comment reply from @author (#41):",
      "  Created: 2026-04-02T08:00:00Z",
      "",
      "  Fixed in abc123",
    ].join("\n"),
  );
});
