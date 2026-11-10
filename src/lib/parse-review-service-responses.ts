import * as z from "zod";

const UNIT_STATUSES = [
  "claims-emitted",
  "no-claims",
  "unit-failed",
  "pending",
  "abandoned",
] as const;

export interface ServicePass {
  id: string;
  sealedAt: string | null;
}

export interface ServiceCoverage {
  complete: boolean;
  slots: {
    lens: string;
    part: string;
    arm: string;
    unitStatus: (typeof UNIT_STATUSES)[number];
    completedWithLoss: boolean;
  }[];
}

export interface ServiceClaim {
  id: string;
  severity: string;
  title: string;
  path: string | null;
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

export const ServiceClaim = z
  .object({
    id: z.string(),
    severity: z.string(),
    title: z.string(),
    anchor: z.object({ path: z.string().nullish() }),
  })
  .transform(
    (item): ServiceClaim => ({
      id: item.id,
      severity: item.severity,
      title: item.title,
      path: item.anchor.path ?? null,
    }),
  );

// The service lists a review's passes oldest first (created_at, then id).
export function parseNewestPass(body: unknown): ServicePass | undefined {
  const newest = PassesResponse.parse(body).passes.at(-1);
  return newest === undefined ? undefined : { id: newest.id, sealedAt: newest.sealed_at };
}

export function parseCoverage(body: unknown): ServiceCoverage {
  const coverage = CoverageResponse.parse(body);
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
}
