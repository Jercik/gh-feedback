const maintainer = { id: 1, login: "maintainer" };
const reviewer = { id: 2, login: "reviewer" };
const colleague = { id: 3, login: "colleague" };
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
    commit_id: "fixture-commit",
    html_url: `${pull.html_url}#issuecomment-100`,
  },
  { id: 11, state: "PENDING", user: maintainer, body: "Private draft", html_url: pull.html_url },
];
const inline = { path: "src/app.ts", position: 9, pull_request_review_id: 10 };
const reviewComments = [
  {
    ...inline,
    id: 201,
    user: reviewer,
    body: "Inline finding",
    created_at: "2026-01-01T00:00:01Z",
  },
  {
    ...inline,
    id: 202,
    user: maintainer,
    body: "<!-- gh-feedback:reply-to:201 -->\nFixed in abc123",
    created_at: "2026-01-01T00:00:02Z",
  },
  {
    ...inline,
    id: 203,
    user: colleague,
    body: "<!-- gh-feedback:reply-to:201 -->\nStill reproduces for me",
    created_at: "2026-01-01T00:00:03Z",
  },
];
const issueComments = [
  { id: 401, user: reviewer, body: "Issue finding", created_at: "2026-01-01T00:00:04Z" },
  {
    id: 402,
    user: maintainer,
    body: "> Replying to comment #401\n\nWhich case?",
    created_at: "2026-01-01T00:00:05Z",
  },
  {
    id: 403,
    user: colleague,
    body: "> Replying to comment #401\n\nThe empty one",
    created_at: "2026-01-01T00:00:06Z",
  },
].map((comment) => ({ ...comment, updated_at: comment.created_at }));
const reactions: Record<string, { user: typeof maintainer; content: string }[]> = {
  "100": [
    { user: maintainer, content: "+1" },
    { user: colleague, content: "-1" },
  ],
  "201": [
    { user: maintainer, content: "rocket" },
    { user: colleague, content: "eyes" },
  ],
  "401": [
    { user: maintainer, content: "confused" },
    { user: colleague, content: "+1" },
  ],
  "202": [],
  "203": [],
  "402": [],
  "403": [],
};

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
  const route = new URL(address).pathname.replace("/api/v1/", "");
  if (route === "settings/api") {
    return response({ max_response_items: 50 });
  }
  if (route === "repos/owner/repo/pulls/7") {
    return response(pull);
  }
  if (route === "repos/owner/repo/pulls/7/reviews") {
    return response(reviews, "2");
  }
  if (route === "repos/owner/repo/pulls/7/reviews/10/comments") {
    return response(reviewComments);
  }
  if (route === "repos/owner/repo/pulls/7/reviews/11/comments") {
    return response([
      { id: 301, user: maintainer, body: "Draft inline", position: 4, path: "draft.ts" },
    ]);
  }
  if (route === "repos/owner/repo/issues/7/comments") {
    return response(issueComments, "3");
  }
  const reacted = /^repos\/owner\/repo\/issues\/comments\/(?<id>\d+)\/reactions$/u.exec(route);
  const found = reactions[reacted?.groups?.id ?? ""];
  if (found !== undefined) {
    return response(found);
  }
  throw new Error(`Unexpected fixture route: ${route}`);
};
