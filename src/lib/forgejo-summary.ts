import type { FeedbackSummary } from "./summary-types.js";
import type { SummaryOptions } from "./feedback-backend.js";
import { fetchFeedbackSnapshot } from "./feedback-snapshot.js";
import { summarizeFeedbackSnapshot } from "./summarize-feedback-snapshot.js";

export async function buildSummary(
  slug: string,
  prNumber: number,
  options: SummaryOptions,
): Promise<FeedbackSummary> {
  const snapshot = await fetchFeedbackSnapshot(slug, prNumber, options.viewer);
  if (!snapshot.stable) {
    throw new Error(
      "Feedback changed between complete passes; rerun summary or inspect snapshot (exit 3).",
    );
  }
  return {
    prNumber,
    prUrl: snapshot.pull.html_url,
    prTitle: snapshot.pull.title,
    items: summarizeFeedbackSnapshot(snapshot, options.hideResolved === true),
  };
}
