import type { SummaryReport } from "./parse-review-summary.js";
import type { PassCoverage, ServiceClaim, ServicePass } from "./review-service-client.js";

export type PassFact =
  | { state: "none" }
  | { state: "pending"; id: string }
  | ({ state: "sealed"; id: string; sealedAt: string } & PassCoverage);

export interface ReviewFacts {
  id: string;
  pass: PassFact;
  claims: {
    unadjudicated: ServiceClaim[];
    ungrounded: ServiceClaim[];
    groundingPending: ServiceClaim[];
  };
}

export interface ReviewDocument {
  schema: "pr-feedback.review";
  version: 1;
  host: string;
  slug: string;
  pr: number;
  summary: SummaryReport | null;
  review: ReviewFacts | null;
}

export function toPassFact(
  pass: ServicePass | undefined,
  coverage: PassCoverage | undefined,
): PassFact {
  if (pass === undefined) {
    return { state: "none" };
  }
  if (pass.sealedAt === null) {
    return { state: "pending", id: pass.id };
  }
  if (coverage === undefined) {
    throw new Error(`Sealed pass ${pass.id} has no coverage`);
  }
  return { state: "sealed", id: pass.id, sealedAt: pass.sealedAt, ...coverage };
}
