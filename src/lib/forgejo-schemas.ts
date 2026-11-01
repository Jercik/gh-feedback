/**
 * Zod schemas for the Forgejo REST /api/v1 responses we consume.
 *
 * Producer-side fields we don't fully control default to .nullish() so a
 * missing key never throws inside a request handler. Schema and inferred type
 * share one PascalCase name.
 */

import * as z from "zod";

const ForgejoUser = z.object({
  login: z.string(),
});

export const ForgejoPull = z.object({
  number: z.number(),
  html_url: z.string(),
  state: z.string(),
  title: z.string(),
  body: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  user: ForgejoUser.nullish(),
  head: z
    .object({
      ref: z.string(),
      sha: z.string(),
      repo: z.object({ full_name: z.string() }).nullish(),
    })
    .nullish(),
  base: z.object({ ref: z.string() }).nullish(),
  draft: z.boolean().nullish(),
});
export type ForgejoPull = z.infer<typeof ForgejoPull>;

export const ForgejoReview = z.object({
  id: z.number(),
  user: ForgejoUser.nullish(),
  state: z.string(),
  body: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  submitted_at: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  html_url: z.string().nullish(),
});
export type ForgejoReview = z.infer<typeof ForgejoReview>;

export const ForgejoReviewComment = z.object({
  id: z.number(),
  body: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  user: ForgejoUser.nullish(),
  pull_request_review_id: z.number().nullish(),
  resolver: ForgejoUser.nullish(),
  path: z.string().nullish(),
  position: z.number().nullish(),
  original_position: z.number().nullish(),
  extra_lines_count: z.number().nullish(),
  created_at: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  html_url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  pull_request_url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
});
export type ForgejoReviewComment = z.infer<typeof ForgejoReviewComment>;

export const ForgejoIssueComment = z.object({
  id: z.number(),
  body: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  user: ForgejoUser.nullish(),
  issue_url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  pull_request_url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  html_url: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
  created_at: z
    .string()
    .nullish()
    .transform((v) => v ?? ""),
});
export type ForgejoIssueComment = z.infer<typeof ForgejoIssueComment>;

export const ForgejoReaction = z.object({
  content: z.string(),
  user: ForgejoUser.nullish(),
});
export type ForgejoReaction = z.infer<typeof ForgejoReaction>;

// Snapshot schemas retain evidence for completeness and stability checks that
// command projections may normalize or omit.
const ForgejoSnapshotUser = ForgejoUser.extend({ id: z.number().nullish() });

export const ForgejoSnapshotReview = ForgejoReview.extend({
  user: ForgejoSnapshotUser.nullish(),
  submitted_at: z.string().nullish(),
  commit_id: z.string().nullish(),
});
export type ForgejoSnapshotReview = z.infer<typeof ForgejoSnapshotReview>;

export const ForgejoSnapshotReviewComment = ForgejoReviewComment.extend({
  user: ForgejoSnapshotUser.nullish(),
  resolver: ForgejoSnapshotUser.nullish(),
  created_at: z.string().nullish(),
  html_url: z.string().nullish(),
});
export type ForgejoSnapshotReviewComment = z.infer<typeof ForgejoSnapshotReviewComment>;

export const ForgejoSnapshotIssueComment = ForgejoIssueComment.extend({
  user: ForgejoSnapshotUser.nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  html_url: z.string().nullish(),
});
export type ForgejoSnapshotIssueComment = z.infer<typeof ForgejoSnapshotIssueComment>;
