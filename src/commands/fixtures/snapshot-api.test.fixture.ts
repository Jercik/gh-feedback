const reviewer = { id: 2, login: "reviewer" };
const viewer = { id: 1, login: "maintainer" };
const pull = {
  number: 7,
  html_url: "https://code.j4k.dev/owner/repo/pulls/7",
  state: "open",
  title: "Fixture PR",
  body: "",
  head: { ref: "fixture", sha: "head-sha", repo: { full_name: "owner/repo" } },
};
const reviews = [
  {
    id: 10,
    state: "COMMENT",
    user: reviewer,
    body: "Overall finding",
    submitted_at: "2026-01-01T00:00:00Z",
    html_url: `${pull.html_url}#issuecomment-100`,
  },
  { id: 11, state: "PENDING", user: viewer, body: "Private draft", html_url: pull.html_url },
  {
    id: 12,
    state: "COMMENT",
    user: reviewer,
    body: "Missing native anchor",
    html_url: pull.html_url,
  },
];
const comments = [
  {
    id: 201,
    user: reviewer,
    body: "First independent finding",
    path: "src/app.ts",
    position: 9,
    pull_request_review_id: 10,
    created_at: "2026-01-01T00:00:01Z",
  },
  {
    id: 202,
    user: reviewer,
    body: "Second independent finding",
    path: "src/app.ts",
    position: 9,
    pull_request_review_id: 10,
    created_at: "2026-01-01T00:00:02Z",
  },
  {
    id: 203,
    user: viewer,
    body: "<!-- gh-feedback:reply-to:201 -->\nFixed first",
    path: "src/app.ts",
    position: 9,
    pull_request_review_id: 10,
    created_at: "2026-01-01T00:00:03Z",
  },
];
let pass = 0;
const response = (body: unknown, count?: string): Response =>
  Response.json(body, { headers: count === undefined ? {} : { "X-Total-Count": count } });
globalThis.fetch = async (input, options): Promise<Response> => {
  if (options?.method !== "GET") {
    throw new Error("Fixture forbids mutations");
  }
  let address: string;
  if (typeof input === "string") {
    address = input;
  } else if (input instanceof URL) {
    address = input.href;
  } else {
    address = input.url;
  }
  const url = new URL(address);
  const route = url.pathname.replace("/api/v1/", "");
  const mode = process.env.SNAPSHOT_FIXTURE_MODE;
  if (route === "user") {
    return response(viewer);
  }
  if (route === "settings/api") {
    return response({ max_response_items: 2 });
  }
  if (route === "repos/owner/repo/pulls") {
    return response([pull]);
  }
  if (route === "repos/owner/repo/pulls/7") {
    pass += 1;
    return response(pull);
  }
  if (route === "repos/owner/repo/pulls/7/reviews") {
    if (mode === "malformed") {
      return response({ invalid: true }, "4");
    }
    const page = url.searchParams.get("page");
    if (url.searchParams.get("limit") !== "2") {
      throw new Error("API cap ignored");
    }
    return response(
      page === "1" ? [reviews[0]] : [reviews[1], reviews[2]],
      mode === "bad-count" ? "invalid" : "4",
    );
  }
  if (route === "repos/owner/repo/pulls/7/reviews/10/comments") {
    return response(
      mode === "resolved"
        ? comments.map((comment) => ({ ...comment, resolver: viewer }))
        : comments,
    );
  }
  if (route === "repos/owner/repo/pulls/7/reviews/11/comments") {
    return response([
      { id: 301, user: viewer, body: "Draft inline", position: 4, path: "draft.ts" },
    ]);
  }
  if (route === "repos/owner/repo/pulls/7/reviews/12/comments") {
    return response([]);
  }
  if (route === "repos/owner/repo/issues/7/comments") {
    return response(
      [
        {
          id: 401,
          user: reviewer,
          body: "Issue finding",
          created_at: "2026-01-01T00:00:04Z",
          updated_at:
            mode === "updated" && pass === 2 ? "2026-01-02T00:00:00Z" : "2026-01-01T00:00:04Z",
        },
      ],
      mode === "issue-gap" ? "2" : "1",
    );
  }
  if (route === "repos/owner/repo/issues/comments/100/reactions") {
    return response([{ user: viewer, content: "+1" }]);
  }
  if (route === "repos/owner/repo/issues/comments/201/reactions") {
    return response([]);
  }
  if (route === "repos/owner/repo/issues/comments/202/reactions") {
    return response([{ user: viewer, content: "rocket" }]);
  }
  if (route === "repos/owner/repo/issues/comments/401/reactions") {
    return response([
      { user: viewer, content: "+1" },
      { user: viewer, content: "-1" },
      { user: reviewer, content: "rocket" },
    ]);
  }
  throw new Error(`Unexpected fixture route: ${url.href}`);
};
