import { pageReviewClaims } from "./page-review-claims.js";
import { createServiceRequest } from "./review-service-request.js";
import { ServiceClaim, parseCoverage, parseNewestPass } from "./parse-review-service-responses.js";
import type { ServiceCoverage, ServicePass } from "./parse-review-service-responses.js";

type ClaimDestination = "unadjudicated" | "ungrounded" | "grounding-pending";

export interface ReviewServiceClient {
  newestPass: (reviewId: string) => Promise<ServicePass | undefined>;
  passCoverage: (reviewId: string, passId: string) => Promise<ServiceCoverage>;
  claimsByDestination: (reviewId: string, destination: ClaimDestination) => Promise<ServiceClaim[]>;
}

export function createReviewServiceClient(options: {
  serviceUrl: string;
  token: string;
}): ReviewServiceClient {
  const request = createServiceRequest(options);

  async function get(route: string, query: Record<string, string> = {}): Promise<unknown> {
    return request("GET", route, query);
  }

  return {
    async newestPass(reviewId) {
      return parseNewestPass(await get(`/v1/reviews/${reviewId}/passes`));
    },

    async passCoverage(reviewId, passId) {
      return parseCoverage(await get(`/v1/reviews/${reviewId}/coverage`, { pass_id: passId }));
    },

    async claimsByDestination(reviewId, destination) {
      return Array.fromAsync(pageReviewClaims(request, reviewId, { destination }, ServiceClaim));
    },
  };
}
