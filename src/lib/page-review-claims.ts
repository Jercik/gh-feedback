import * as z from "zod";
import type { ServiceRequest } from "./review-service-request.js";

const CLAIMS_PAGE_LIMIT = 500;

export async function* pageReviewClaims<Item extends z.ZodType>(
  request: ServiceRequest,
  reviewId: string,
  query: Record<string, string>,
  item: Item,
): AsyncGenerator<z.output<Item>> {
  const ClaimsPage = z.object({ items: z.array(item), next_after: z.string().nullable() });
  const seen = new Set<string>();
  let after: string | undefined;
  do {
    const page = ClaimsPage.parse(
      await request("GET", `/v1/reviews/${reviewId}/claims`, {
        ...query,
        limit: String(CLAIMS_PAGE_LIMIT),
        ...(after !== undefined && { after }),
      }),
    );
    yield* page.items;
    after = page.next_after ?? undefined;
    if (after !== undefined) {
      if (seen.has(after)) {
        throw new Error(`Review service claims cursor repeated for review ${reviewId}`);
      }
      seen.add(after);
    }
  } while (after !== undefined);
}
