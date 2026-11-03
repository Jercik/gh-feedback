import * as fs from "node:fs";

const pull = {
  number: 7,
  html_url: "https://code.j4k.dev/owner/repo/pulls/7",
  state: "open",
  title: "Fixture PR",
  head: { ref: "fixture", sha: "head", repo: { full_name: "owner/repo" } },
};
const viewerReactions: Record<string, string[]> = { "401": [], "402": ["+1"] };

const mutationLogEnv = process.env.FIXTURE_MUTATION_LOG;
if (!mutationLogEnv) {
  throw new Error("FIXTURE_MUTATION_LOG must name the mutation log file");
}
const mutationLog: string = mutationLogEnv;

function recordMutation(method: string, route: string, body: unknown): void {
  fs.appendFileSync(mutationLog, `${JSON.stringify({ method, route, body })}\n`);
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
  const route = new URL(address).pathname.replace("/api/v1/", "");
  const method = options?.method ?? "GET";
  if (method !== "GET") {
    recordMutation(
      method,
      route,
      typeof options?.body === "string" ? JSON.parse(options.body) : null,
    );
    if (method === "POST" && route === "repos/owner/repo/issues/7/comments") {
      return Response.json(
        { id: 501, html_url: "https://code.j4k.dev/owner/repo/pulls/7#issuecomment-501" },
        { status: 201 },
      );
    }
    if (/^repos\/owner\/repo\/issues\/comments\/40[12]\/reactions$/u.test(route)) {
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
  if (route === "repos/owner/repo/pulls") {
    return Response.json([pull], { headers: { "X-Total-Count": "1" } });
  }
  if (route === "repos/owner/repo/pulls/7/reviews") {
    return Response.json([], { headers: { "X-Total-Count": "0" } });
  }
  const comment = /^repos\/owner\/repo\/issues\/comments\/(?<id>40[12])$/u.exec(route);
  if (comment) {
    return Response.json({
      id: Number(comment.groups?.id),
      pull_request_url: pull.html_url,
      user: { login: "reviewer" },
    });
  }
  const reactions = /^repos\/owner\/repo\/issues\/comments\/(?<id>40[12])\/reactions$/u.exec(route);
  if (reactions) {
    const contents = viewerReactions[reactions.groups?.id ?? ""] ?? [];
    return Response.json(
      contents.map((content) => ({ content, user: { login: "maintainer" } })),
      { headers: { "X-Total-Count": String(contents.length) } },
    );
  }
  throw new Error(`Unexpected fixture route: ${route}`);
};
