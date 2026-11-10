const serviceOrigin = "https://review.example.test";
const reviewId = "01M71ZA6QAKR3HA7G41W0553BN";
const stamped = `<!-- review:summary -->\n**Review** \`${reviewId}\` — head \`${"a".repeat(40)}\`\n\n# Review`;

const claim = (id: string, path: string | null): object => ({
  id,
  severity: "high",
  title: `Title ${id}`,
  anchor: path === null ? { kind: "pr" } : { kind: "line", path, line: 3 },
});

globalThis.fetch = async (input): Promise<Response> => {
  let address: string;
  if (typeof input === "string") {
    address = input;
  } else if (input instanceof URL) {
    address = input.href;
  } else {
    address = input.url;
  }
  const url = new URL(address);
  if (url.origin === serviceOrigin) {
    if (process.env.REVIEW_FIXTURE_MODE === "no-summary") {
      throw new Error(`Review service must not be called: ${url.href}`);
    }
    if (url.pathname === `/v1/reviews/${reviewId}/passes`) {
      return Response.json({
        passes: [
          { id: "OLD", sealed_at: null },
          { id: "NEW", sealed_at: "2026-11-10T05:36:45.478Z", extra: true },
        ],
      });
    }
    if (url.pathname === `/v1/reviews/${reviewId}/coverage`) {
      if (url.searchParams.get("pass_id") !== "NEW") {
        throw new Error("Coverage must be read for the newest pass");
      }
      return Response.json({
        complete: true,
        slots: [
          {
            lens: "general-bug",
            part: "whole",
            arm: "default",
            unit_status: "no-claims",
            completed_with_loss: false,
            runs: [],
          },
        ],
      });
    }
    if (url.pathname === `/v1/reviews/${reviewId}/claims`) {
      const destination = url.searchParams.get("destination");
      const after = url.searchParams.get("after");
      if (destination === "unadjudicated" && after === null) {
        return Response.json({ items: [claim("C1", "src/a.ts")], next_after: "cursor-1" });
      }
      if (destination === "unadjudicated" && after === "cursor-1") {
        return Response.json({ items: [claim("C2", null)], next_after: null });
      }
      return Response.json({ items: [], next_after: null });
    }
    throw new Error(`Unexpected service route: ${url.href}`);
  }
  if (url.pathname === "/api/v1/repos/owner/repo/issues/7/comments") {
    const comments =
      process.env.REVIEW_FIXTURE_MODE === "no-summary"
        ? [{ id: 5, user: { id: 2, login: "human" }, body: "Looks fine" }]
        : [
            { id: 9, user: { id: 2, login: "human" }, body: stamped },
            {
              id: 6,
              user: { id: -2, login: "actions" },
              body: stamped,
              updated_at: "2026-11-10T05:36:22Z",
            },
          ];
    return Response.json(comments);
  }
  throw new Error(`Unexpected fixture route: ${url.href}`);
};
