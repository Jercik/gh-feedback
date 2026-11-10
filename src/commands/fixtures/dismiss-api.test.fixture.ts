import * as fs from "node:fs";

const serviceOrigin = "https://review.example.test";
const reviewId = "01M71ZA6QAKR3HA7G41W0553BN";
const claimId = "01M71ZA6QAKR3HA7G41W0553BP";
const claimBody = `<!-- review:claim:${claimId} -->\n**High** Title\n\nclaim \`${claimId}\` of review \`${reviewId}\`\n`;

const mutationLogEnv = process.env.FIXTURE_MUTATION_LOG;
if (!mutationLogEnv) {
  throw new Error("FIXTURE_MUTATION_LOG must name the mutation log file");
}
const mutationLog: string = mutationLogEnv;
function recordMutation(method: string, route: string, body: unknown): void {
  fs.appendFileSync(mutationLog, `${JSON.stringify({ method, route, body })}\n`);
}

const comment = (id: number, reviewNumber: number, path: string, body: string, userId: number) => ({
  id,
  pull_request_review_id: reviewNumber,
  path,
  position: 4,
  original_position: 0,
  body,
  user: { id: userId, login: userId === -2 ? "actions" : "reviewer" },
});
const reviews = [
  { id: 10, state: "COMMENT", user: { id: -2, login: "actions" } },
  { id: 11, state: "COMMENT", user: { id: 2, login: "reviewer" } },
];
const reviewComments: Record<string, object[]> = {
  "10": [comment(301, 10, "file.ts", claimBody, -2), comment(303, 10, "other.ts", claimBody, -2)],
  "11": [comment(302, 11, "file.ts", claimBody, 2), comment(304, 11, "file.ts", "Looks good", 2)],
};
const viewerReactions: Record<string, string[]> = {
  "301": [],
  "302": [],
  "303": ["hooray"],
  "304": ["hooray"],
};

let currentDisposition: object | null = null;

function serviceResponse(method: string, url: URL, body: unknown): Response {
  if (method === "GET" && url.pathname === `/v1/reviews/${reviewId}`) {
    return Response.json({ review: { repo: { forge_host: "code.j4k.dev", slug: "owner/repo" } } });
  }
  if (method === "GET" && url.pathname === `/v1/reviews/${reviewId}/claims`) {
    return Response.json({
      items: [
        {
          id: claimId,
          anchor: { kind: "line", path: "file.ts", line: 3 },
          disposition: { current: currentDisposition },
        },
      ],
      next_after: null,
    });
  }
  if (method === "POST" && url.pathname === `/v1/claims/${claimId}/dispositions`) {
    const sent = body as { kind: string; rationale: string };
    currentDisposition = {
      id: "01M71ZA6QAKR3HA7G41W0553BR",
      kind: sent.kind,
      rationale: sent.rationale,
      created_at: "2026-11-10T12:00:00Z",
    };
    const stored = { ...currentDisposition, claim_id: claimId };
    if (process.env.FIXTURE_SUPERSEDED === "1") {
      currentDisposition = {
        id: "01M71ZA6QAKR3HA7G41W0553BS",
        kind: "reopened",
        rationale: "Later decision",
        created_at: "2026-11-10T12:00:01Z",
      };
    }
    return Response.json({ disposition: stored }, { status: 201 });
  }
  throw new Error(`Unexpected service route: ${method} ${url.href}`);
}

globalThis.fetch = async (input, options): Promise<Response> => {
  let address: string;
  if (typeof input === "string") {
    address = input;
  } else if (input instanceof URL) {
    address = input.href;
  } else {
    address = input.url;
  }
  const url = new URL(address);
  const method = options?.method ?? "GET";
  const body = typeof options?.body === "string" ? JSON.parse(options.body) : null;
  if (url.origin === serviceOrigin) {
    if (method !== "GET") {
      recordMutation(method, url.pathname, body);
    }
    return serviceResponse(method, url, body);
  }
  const route = url.pathname.replace("/api/v1/", "");
  if (method !== "GET") {
    recordMutation(method, route, body);
    if (method === "POST" && route === "repos/owner/repo/pulls/7/reviews/10/comments") {
      return Response.json(
        { id: 501, html_url: "https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501" },
        { status: 201 },
      );
    }
    if (/^repos\/owner\/repo\/issues\/comments\/30\d\/reactions$/u.test(route)) {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected fixture mutation: ${method} ${route}`);
  }
  if (route === "settings/api") {
    return Response.json({ max_response_items: 50 });
  }
  if (route === "user") {
    return Response.json({ login: "maintainer" });
  }
  if (route === "repos/owner/repo/pulls/7/reviews") {
    return Response.json(reviews, { headers: { "X-Total-Count": String(reviews.length) } });
  }
  const single = /^repos\/owner\/repo\/pulls\/7\/reviews\/(?<id>1[01])$/u.exec(route);
  if (single) {
    return Response.json(reviews.find((review) => String(review.id) === single.groups?.id));
  }
  const comments = /^repos\/owner\/repo\/pulls\/7\/reviews\/(?<id>1[01])\/comments$/u.exec(route);
  if (comments) {
    const list = reviewComments[comments.groups?.id ?? ""] ?? [];
    return Response.json(list, { headers: { "X-Total-Count": String(list.length) } });
  }
  if (/^repos\/owner\/repo\/issues\/comments\/30\d$/u.test(route)) {
    return new Response(null, { status: 204 });
  }
  const reactions = /^repos\/owner\/repo\/issues\/comments\/(?<id>30\d)\/reactions$/u.exec(route);
  if (reactions) {
    const contents = viewerReactions[reactions.groups?.id ?? ""] ?? [];
    return Response.json(
      contents.map((content) => ({ content, user: { login: "maintainer" } })),
      { headers: { "X-Total-Count": String(contents.length) } },
    );
  }
  throw new Error(`Unexpected fixture route: ${route}`);
};
