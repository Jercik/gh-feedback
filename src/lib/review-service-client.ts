import * as z from "zod";
import { pageReviewClaims } from "./page-review-claims.js";
import { createServiceRequest } from "./review-service-request.js";

const UNIT_STATUSES = [
  "claims-emitted",
  "no-claims",
  "unit-failed",
  "pending",
  "abandoned",
] as const;

type ClaimDestination = "unadjudicated" | "ungrounded" | "grounding-pending";

export interface ServicePass {
  id: string;
  sealedAt: string | null;
}

interface CoverageSlot {
  lens: string;
  part: string;
  arm: string;
  unitStatus: (typeof UNIT_STATUSES)[number];
  completedWithLoss: boolean;
}

export interface PassCoverage {
  complete: boolean;
  slots: CoverageSlot[];
}

export interface ServiceClaim {
  id: string;
  severity: string;
  title: string;
  path: string | null;
}

export interface ReviewServiceClient {
  newestPass: (reviewId: string) => Promise<ServicePass | undefined>;
  passCoverage: (reviewId: string, passId: string) => Promise<PassCoverage>;
  claimsByDestination: (reviewId: string, destination: ClaimDestination) => Promise<ServiceClaim[]>;
}

const PassesResponse = z.object({
  passes: z.array(z.object({ id: z.string(), sealed_at: z.string().nullable() })),
});

const CoverageResponse = z.object({
  complete: z.boolean(),
  slots: z.array(
    z.object({
      lens: z.string(),
      part: z.string(),
      arm: z.string(),
      unit_status: z.enum(UNIT_STATUSES),
      completed_with_loss: z.boolean(),
    }),
  ),
});

const ClaimItem = z.object({
  id: z.string(),
  severity: z.string(),
  title: z.string(),
  anchor: z.object({ path: z.string().nullish() }),
});

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
      const { passes } = PassesResponse.parse(await get(`/v1/reviews/${reviewId}/passes`));
      const newest = passes.at(-1);
      return newest === undefined ? undefined : { id: newest.id, sealedAt: newest.sealed_at };
    },

    async passCoverage(reviewId, passId) {
      const coverage = CoverageResponse.parse(
        await get(`/v1/reviews/${reviewId}/coverage`, { pass_id: passId }),
      );
      return {
        complete: coverage.complete,
        slots: coverage.slots.map((slot) => ({
          lens: slot.lens,
          part: slot.part,
          arm: slot.arm,
          unitStatus: slot.unit_status,
          completedWithLoss: slot.completed_with_loss,
        })),
      };
    },

    async claimsByDestination(reviewId, destination) {
      const items = await Array.fromAsync(
        pageReviewClaims(request, reviewId, { destination }, ClaimItem),
      );
      return items.map((item) => ({
        id: item.id,
        severity: item.severity,
        title: item.title,
        path: item.anchor.path ?? null,
      }));
    },
  };
}
