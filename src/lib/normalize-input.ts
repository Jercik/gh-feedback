/**
 * Input normalization helpers for classifier and reaction inputs.
 */

import type { Classifier, ReactionContent } from "./types.js";
import {
  CLASSIFIERS,
  CLASSIFIER_ALIASES,
  ALLOWED_REACTIONS,
  REACTION_ALIASES,
  REACTION_ENUM_MAP,
} from "./constants.js";
import { exitWithMessage } from "./git-helpers.js";

export function normalizeClassifier(input?: string): Classifier {
  if (!input) return "RESOLVED";
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase().replaceAll(/[^A-Z_]/gu, "_");
  if ((CLASSIFIERS as readonly string[]).includes(upper)) {
    return upper as Classifier;
  }
  const alias = CLASSIFIER_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  exitWithMessage(
    `Error: Unsupported reason "${input}". Use one of: ${CLASSIFIERS.join(", ")}.`,
  );
}

export function normalizeReactionInput(input: string): ReactionContent {
  const trimmed = input.trim();
  const lowerKey = trimmed.toLowerCase();
  const alias = REACTION_ALIASES[lowerKey];
  if (alias) return alias;

  const upperKey = trimmed.toUpperCase();
  const enumMatch = REACTION_ENUM_MAP[upperKey];
  if (enumMatch) return enumMatch;

  if ((ALLOWED_REACTIONS as readonly string[]).includes(lowerKey)) {
    return lowerKey as ReactionContent;
  }

  exitWithMessage(
    `Error: Unsupported reaction "${input}". Use one of: ${ALLOWED_REACTIONS.join(", ")}.`,
  );
}
