import { toPassFact } from "./build-review-document.js";
import type { ReviewDocument, ReviewFacts } from "./build-review-document.js";
import { forgejoApiHost, forgejoFetchList } from "./forgejo-cli.js";
import { ForgejoSnapshotIssueComment } from "./forgejo-schemas.js";
import { findSummaryReport } from "./parse-review-summary.js";
import type { ReviewStamp } from "./parse-review-summary.js";
import { createReviewServiceClient } from "./review-service-client.js";
import { loadReviewServiceCredentials } from "./review-service-credentials.js";

async function fetchReviewFacts(
  host: string,
  slug: string,
  stamp: ReviewStamp,
): Promise<ReviewFacts> {
  const credentials = loadReviewServiceCredentials(host, slug);
  const client = createReviewServiceClient({
    serviceUrl: credentials.serviceUrl,
    token: credentials.token,
  });
  const id = stamp.reviewId;
  const newest = await client.newestPass(id);
  const coverage =
    newest === undefined || newest.sealedAt === null
      ? undefined
      : await client.passCoverage(id, newest.id);
  const [unadjudicated, ungrounded, groundingPending] = await Promise.all([
    client.claimsByDestination(id, "unadjudicated"),
    client.claimsByDestination(id, "ungrounded"),
    client.claimsByDestination(id, "grounding-pending"),
  ]);
  return {
    id,
    pass: toPassFact(newest, coverage),
    claims: { unadjudicated, ungrounded, groundingPending },
  };
}

export async function fetchReviewDocument(slug: string, pr: number): Promise<ReviewDocument> {
  const host = forgejoApiHost();
  const items = await forgejoFetchList<unknown>(`repos/${slug}/issues/${pr}/comments`);
  const summary = findSummaryReport(items.map((item) => ForgejoSnapshotIssueComment.parse(item)));
  const review =
    summary === null || summary.stamp === null
      ? null
      : await fetchReviewFacts(host, slug, summary.stamp);
  return { schema: "pr-feedback.review", version: 1, host, slug, pr, summary, review };
}
