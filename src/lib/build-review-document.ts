import type { SummaryReport } from "./parse-review-summary.js";
import type {
  ServiceClaim,
  ServiceCoverage,
  ServicePass,
} from "./parse-review-service-responses.js";

interface CoverageSlot {
  lens: string;
  part: string;
  arm: string;
  unitStatus: ServiceCoverage["slots"][number]["unitStatus"];
  completedWithLoss: boolean;
}

interface ReviewClaim {
  id: string;
  severity: string;
  title: string;
  path: string | null;
}

type NewestPass =
  | { state: "none" }
  | { state: "pending"; id: string }
  | { state: "sealed"; id: string; sealedAt: string };

type SealedPass = Extract<NewestPass, { state: "sealed" }>;

type PassFact =
  | Exclude<NewestPass, SealedPass>
  | (SealedPass & { complete: boolean; slots: CoverageSlot[] });

export interface ReviewFacts {
  id: string;
  pass: PassFact;
  claims: {
    unadjudicated: ReviewClaim[];
    ungrounded: ReviewClaim[];
    groundingPending: ReviewClaim[];
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

export function classifyNewestPass(newest: ServicePass | undefined): NewestPass {
  if (newest === undefined) {
    return { state: "none" };
  }
  if (newest.sealedAt === null) {
    return { state: "pending", id: newest.id };
  }
  return { state: "sealed", id: newest.id, sealedAt: newest.sealedAt };
}

export function toSealedPassFact(pass: SealedPass, coverage: ServiceCoverage): PassFact {
  return {
    ...pass,
    complete: coverage.complete,
    slots: coverage.slots.map((slot) => ({
      lens: slot.lens,
      part: slot.part,
      arm: slot.arm,
      unitStatus: slot.unitStatus,
      completedWithLoss: slot.completedWithLoss,
    })),
  };
}

export function toReviewClaim(claim: ServiceClaim): ReviewClaim {
  return {
    id: claim.id,
    severity: claim.severity,
    title: claim.title,
    path: claim.path,
  };
}
