import * as z from "zod";
import { CLAIMS_PAGE_LIMIT, createServiceRequest } from "./review-service-request.js";
import { dispositionKinds } from "./service-disposition.js";
import type { DispositionKind, RecordedDisposition } from "./service-disposition.js";

interface ServiceDisposition {
  id: string;
  kind: DispositionKind;
  rationale: string;
  createdAt: string;
}

interface ServiceClaimState {
  id: string;
  path: string | null;
  currentDisposition: ServiceDisposition | null;
}

export interface ReviewServiceDispositionClient {
  reviewRepository: (reviewId: string) => Promise<{ forgeHost: string; slug: string }>;
  claim: (reviewId: string, claimId: string) => Promise<ServiceClaimState | undefined>;
  recordDisposition: (
    claimId: string,
    disposition: { key: string; kind: DispositionKind; rationale: string },
  ) => Promise<RecordedDisposition>;
}

const DispositionKindWire = z.enum(dispositionKinds);

const ReviewResponse = z.object({
  review: z.object({ repo: z.object({ forge_host: z.string(), slug: z.string() }) }),
});

const ProjectedClaimsPage = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      anchor: z.object({ path: z.string().nullish() }),
      disposition: z.object({
        current: z
          .object({
            id: z.string(),
            kind: DispositionKindWire,
            rationale: z.string(),
            created_at: z.string(),
          })
          .nullable(),
      }),
    }),
  ),
  next_after: z.string().nullable(),
});

const DispositionResponse = z.object({
  disposition: z.object({
    id: z.string(),
    claim_id: z.string(),
    kind: DispositionKindWire,
    rationale: z.string(),
  }),
});

export function createReviewServiceDispositionClient(options: {
  serviceUrl: string;
  token: string;
}): ReviewServiceDispositionClient {
  const request = createServiceRequest(options);

  return {
    async reviewRepository(reviewId) {
      const { review } = ReviewResponse.parse(await request("GET", `/v1/reviews/${reviewId}`, {}));
      return { forgeHost: review.repo.forge_host, slug: review.repo.slug };
    },

    async claim(reviewId, claimId) {
      const seen = new Set<string>();
      let after: string | undefined;
      do {
        const page = ProjectedClaimsPage.parse(
          await request("GET", `/v1/reviews/${reviewId}/claims`, {
            limit: String(CLAIMS_PAGE_LIMIT),
            ...(after !== undefined && { after }),
          }),
        );
        const found = page.items.find((item) => item.id === claimId);
        if (found !== undefined) {
          const { current } = found.disposition;
          return {
            id: found.id,
            path: found.anchor.path ?? null,
            currentDisposition:
              current === null
                ? null
                : {
                    id: current.id,
                    kind: current.kind,
                    rationale: current.rationale,
                    createdAt: current.created_at,
                  },
          };
        }
        after = page.next_after ?? undefined;
        if (after !== undefined) {
          if (seen.has(after)) {
            throw new Error("Review service claims cursor repeated");
          }
          seen.add(after);
        }
      } while (after !== undefined);
      return undefined;
    },

    async recordDisposition(claimId, disposition) {
      const { disposition: stored } = DispositionResponse.parse(
        await request(
          "POST",
          `/v1/claims/${claimId}/dispositions`,
          {},
          {
            disposition_key: disposition.key,
            kind: disposition.kind,
            rationale: disposition.rationale,
          },
        ),
      );
      return {
        id: stored.id,
        claimId: stored.claim_id,
        kind: stored.kind,
        rationale: stored.rationale,
      };
    },
  };
}
