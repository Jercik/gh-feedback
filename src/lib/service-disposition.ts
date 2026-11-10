const RATIONALE_MAX = 16_384;

export const dispositionKinds = ["fixed", "dismissed", "wont-fix", "reopened"] as const;

export type DispositionKind = (typeof dispositionKinds)[number];

export interface RecordedDisposition {
  id: string;
  claimId: string;
  kind: DispositionKind;
  rationale: string;
}

export function parseDispositionRationale(message: string): string {
  if (message.length === 0 || message.length > RATIONALE_MAX || message.includes("\0")) {
    throw new Error(
      `Error: The message becomes the disposition rationale and must contain 1-${RATIONALE_MAX} characters without NUL.`,
    );
  }
  return message;
}

export function buildDispositionKey(
  host: string,
  slug: string,
  prNumber: number,
  replyId: number,
): string {
  return `forgejo:${host}:${slug}:${prNumber}:outcome:${replyId}`;
}

export function isDispositionRecorded(
  current: { kind: DispositionKind; rationale: string } | null,
  kind: DispositionKind,
  rationale: string,
): boolean {
  return current !== null && current.kind === kind && current.rationale === rationale;
}

// A later or different decision is recorded on the claim, so repeating the command would overwrite it.
export class DispositionConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispositionConflictError";
  }
}

export function assertStoredDisposition(
  stored: RecordedDisposition,
  sent: { claimId: string; kind: DispositionKind; rationale: string },
): void {
  if (
    stored.claimId !== sent.claimId ||
    stored.kind !== sent.kind ||
    stored.rationale !== sent.rationale
  ) {
    throw new DispositionConflictError(
      "Review service returned a different disposition than the one sent; inspect the claim before deciding again",
    );
  }
}

export function assertCurrentDisposition(currentId: string | undefined, storedId: string): void {
  if (currentId !== storedId) {
    throw new DispositionConflictError(
      "disposition was superseded by a later decision; inspect the claim before deciding again",
    );
  }
}
