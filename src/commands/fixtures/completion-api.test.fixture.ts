const pull = {
  number: 7,
  html_url: "https://code.j4k.dev/owner/repo/pulls/7",
  state: "open",
  title: "Fixture PR",
  head: { ref: "fixture", sha: "head", repo: { full_name: "owner/repo" } },
};
const inline = {
  id: 201,
  pull_request_review_id: 10,
  path: "file.ts",
  position: 4,
  original_position: 0,
  user: { login: "reviewer" },
};

let acknowledged = false;
process.on("beforeExit", () => {
  if (!acknowledged) {
    console.error("Fixture did not receive the acknowledgement reaction");
    process.exitCode = 1;
  }
});

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
  if (
    options?.method === "POST" &&
    /^repos\/owner\/repo\/issues\/comments\/(?:201|401)\/reactions$/u.test(route)
  ) {
    if (options.body !== JSON.stringify({ content: "rocket" })) {
      throw new Error("Fixture expected the acknowledgement reaction");
    }
    acknowledged = true;
    return new Response(null, { status: 204 });
  }
  if (options?.method !== "GET") {
    throw new Error(`Unexpected fixture mutation: ${route}`);
  }
  if (route === "settings/api") {
    return Response.json({ max_response_items: 2 });
  }
  if (route === "user") {
    return Response.json({ login: "maintainer" });
  }
  if (route === "repos/owner/repo/pulls") {
    return Response.json([pull]);
  }
  if (route === "repos/owner/repo/pulls/7/reviews") {
    return Response.json([{ id: 10, state: "COMMENT" }], { headers: { "X-Total-Count": "1" } });
  }
  if (route === "repos/owner/repo/pulls/7/reviews/10/comments") {
    return Response.json([inline]);
  }
  if (route === "repos/owner/repo/issues/comments/201") {
    return new Response(null, { status: 204 });
  }
  if (route === "repos/owner/repo/issues/comments/401") {
    return Response.json({ id: 401, pull_request_url: pull.html_url, user: { login: "reviewer" } });
  }
  if (/^repos\/owner\/repo\/issues\/comments\/(?:201|401)\/reactions$/u.test(route)) {
    return Response.json([]);
  }
  throw new Error(`Unexpected fixture route: ${route}`);
};
