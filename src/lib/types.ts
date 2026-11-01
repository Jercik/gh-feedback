export const REACTION_CONTENTS = [
  "+1",
  "-1",
  "laugh",
  "confused",
  "heart",
  "hooray",
  "rocket",
  "eyes",
] as const;
export type ReactionContent = (typeof REACTION_CONTENTS)[number];

export interface Reaction {
  readonly content: string;
  readonly count: number;
  readonly viewerHasReacted: boolean;
  readonly users: readonly string[];
}

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED" | "DISMISSED" | "PENDING";
